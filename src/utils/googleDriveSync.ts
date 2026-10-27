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
import { BackupPackage, setActiveAccountNamespace } from './storage.ts';

// Initialize Firebase App singleton safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const DRIVE_FILE_NAME = 'ResiMed-Censo-MI.json';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const provider = new GoogleAuthProvider();
provider.addScope(DRIVE_FILE_SCOPE);
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
const SESSION_TOKEN_KEY = 'resimed_gdrive_access_token_v2';
const SESSION_USER_KEY = 'resimed_gdrive_user_info_v2';
const WORKSPACE_MODE_KEY = 'resimed_workspace_mode_v2'; // 'drive' | 'local' | 'demo' | null

export interface SavedDriveUserInfo {
  email: string;
  displayName: string;
  uid: string;
}

let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_KEY) : null;

export type WorkspaceMode = 'drive' | 'local' | 'demo' | null;

export function getWorkspaceMode(): WorkspaceMode {
  try {
    const mode = localStorage.getItem(WORKSPACE_MODE_KEY);
    if (mode === 'drive' || mode === 'local' || mode === 'demo') return mode;
    return null;
  } catch {
    return null;
  }
}

export function setWorkspaceMode(mode: WorkspaceMode): void {
  try {
    if (!mode) {
      localStorage.removeItem(WORKSPACE_MODE_KEY);
    } else {
      localStorage.setItem(WORKSPACE_MODE_KEY, mode);
    }
  } catch (e) {
    console.error('Error setting workspace mode:', e);
  }
}

export function getSavedDriveUser(): SavedDriveUserInfo | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedDriveUserInfo;
  } catch {
    return null;
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const userInfo: SavedDriveUserInfo = {
        email: user.email || user.uid,
        displayName: user.displayName || user.email || 'Usuario Google Drive',
        uid: user.uid,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userInfo));
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
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
      throw new Error('No se pudo obtener el token de acceso de Google Drive');
    }

    cachedAccessToken = credential.accessToken;
    const emailKey = (result.user.email || result.user.uid).trim().toLowerCase();
    setActiveAccountNamespace(emailKey);
    setWorkspaceMode('drive');

    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_TOKEN_KEY, cachedAccessToken);
      localStorage.setItem(
        SESSION_USER_KEY,
        JSON.stringify({
          email: result.user.email || result.user.uid,
          displayName: result.user.displayName || result.user.email || 'Usuario Google Drive',
          uid: result.user.uid,
        })
      );
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

export const clearExpiredAccessToken = (): void => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
};

export const googleLogout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    setWorkspaceMode(null);
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
 * Search for the shared ResiMed file in user's Google Drive (Always bypasses browser HTTP cache)
 */
export async function findDriveCensusFile(accessToken: string): Promise<DriveFileInfo | null> {
  const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)&spaces=drive&_cb=${Date.now()}`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });

  if (response.status === 401) {
    clearExpiredAccessToken();
    throw new Error('DRIVE_TOKEN_EXPIRED');
  }

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
 * Downloads the census JSON from Google Drive (Always bypasses browser HTTP cache)
 */
export async function downloadCensusFromDrive(
  fileId: string,
  accessToken: string
): Promise<{ data: BackupPackage; modifiedTime?: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&_cb=${Date.now()}`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });

  if (response.status === 401) {
    clearExpiredAccessToken();
    throw new Error('DRIVE_TOKEN_EXPIRED');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al descargar archivo de Google Drive: ${response.status} - ${errorText}`);
  }

  const json: BackupPackage = await response.json();
  return { data: json };
}

/**
 * Uploads (create or replace) the authoritative census JSON in Google Drive
 */
export async function saveCensusToDrive(
  backupData: BackupPackage,
  accessToken: string
): Promise<{ fileId: string; updatedTime: string; isNew: boolean }> {
  const existingFile = await findDriveCensusFile(accessToken);
  const jsonContent = JSON.stringify(backupData, null, 2);

  if (existingFile) {
    // Update existing file content
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media&fields=id,modifiedTime`;
    const patchResponse = await fetch(uploadUrl, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonContent,
    });

    if (patchResponse.status === 401) {
      clearExpiredAccessToken();
      throw new Error('DRIVE_TOKEN_EXPIRED');
    }

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

    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';
    const postResponse = await fetch(createUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (postResponse.status === 401) {
      clearExpiredAccessToken();
      throw new Error('DRIVE_TOKEN_EXPIRED');
    }

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
