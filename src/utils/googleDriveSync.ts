import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { BackupPackage } from './storage.ts';

// Initialize Firebase App singleton safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const DRIVE_FILE_NAME = 'ResiMed-Censo-MI.json';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const provider = new GoogleAuthProvider();
provider.addScope(DRIVE_FILE_SCOPE);

let isSigningIn = false;
const SESSION_TOKEN_KEY = 'resimed_gdrive_access_token_v1';
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_TOKEN_KEY) : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Access token in memory needs refresh or user interaction
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google');
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_TOKEN_KEY, cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
};

export function getFirebaseProjectId(): string {
  return firebaseConfig.projectId || 'gen-lang-client-0796485781';
}

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Search for the shared ResiMed file in user's Google Drive
 */
export async function findDriveCensusFile(accessToken: string): Promise<DriveFileInfo | null> {
  const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al buscar archivo en Google Drive: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0] as DriveFileInfo;
  }
  return null;
}

/**
 * Downloads the census JSON from Google Drive
 */
export async function downloadCensusFromDrive(
  fileId: string,
  accessToken: string
): Promise<{ data: BackupPackage; modifiedTime?: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al descargar archivo de Google Drive: ${response.status} - ${errorText}`);
  }

  const json: BackupPackage = await response.json();
  return { data: json };
}

/**
 * Uploads (create or replace) the census JSON in Google Drive
 */
export async function saveCensusToDrive(
  backupData: BackupPackage,
  accessToken: string
): Promise<{ fileId: string; updatedTime: string; isNew: boolean }> {
  const existingFile = await findDriveCensusFile(accessToken);
  const jsonContent = JSON.stringify(backupData, null, 2);

  if (existingFile) {
    // Update existing file content
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
    const patchResponse = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonContent,
    });

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      throw new Error(`Error al actualizar censo en Google Drive: ${patchResponse.status} - ${errorText}`);
    }

    const result = await patchResponse.json();
    return {
      fileId: existingFile.id,
      updatedTime: result.modifiedTime || new Date().toISOString(),
      isNew: false,
    };
  } else {
    // Create new file with multipart upload
    const metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: 'application/json',
      description: 'Censo hospitalario y notas de evolución de Medicina Interna - ResiMed MI',
    };

    const boundary = '-------resimed_boundary_' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      jsonContent +
      closeDelimiter;

    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const postResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      throw new Error(`Error al crear archivo en Google Drive: ${postResponse.status} - ${errorText}`);
    }

    const created = await postResponse.json();
    return {
      fileId: created.id,
      updatedTime: created.modifiedTime || new Date().toISOString(),
      isNew: true,
    };
  }
}
