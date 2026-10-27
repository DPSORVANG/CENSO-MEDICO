import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  Building2,
  Tag,
  ClipboardList,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  FileText,
  Pill,
} from 'lucide-react';
import {
  ResidentProfile,
  HospitalServiceItem,
  AttendingPhysicianItem,
  PhysicalExamTemplateItem,
} from '../types/clinical.ts';
import {
  defaultServicesCatalog,
  defaultAttendingPhysicianItems,
  defaultAvailableTags,
} from '../data/seedPatients.ts';
import {
  DEFAULT_SUBJECTIVE_PRESETS,
  DEFAULT_PHYSICAL_EXAM_TEMPLATES,
  DEFAULT_DIET_PRESETS,
  DEFAULT_MEDICATION_ROUTES,
  DEFAULT_AHF_PRESETS,
  DEFAULT_APNP_PRESETS,
  DEFAULT_APP_PRESETS,
} from '../utils/clinicalLogic.ts';
import { InfoPopover } from './InfoPopover.tsx';

export type SettingsTabKey =
  | 'institution'
  | 'doctors'
  | 'services'
  | 'tags'
  | 'nursing'
  | 'templates';

interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ResidentProfile;
  initialTab?: SettingsTabKey;
  isAdmin?: boolean;
  onRequestAdminMode?: () => void;
  onSaveProfile: (updated: ResidentProfile) => void;
  showToast: (msg: string) => void;
}

const PRESET_COLORS = [
  '#2563eb', // Blue
  '#0d9488', // Teal
  '#4f46e5', // Indigo
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#e11d48', // Rose / Red
  '#ea580c', // Orange
  '#d97706', // Amber
  '#059669', // Emerald
  '#0891b2', // Cyan
  '#475569', // Slate
];

const SPECIALTY_PRESETS = [
  'Medicina Interna',
  'Cirugía General',
  'Ginecología y Obstetricia',
  'Urgencias Médico-Quirúrgicas',
  'Terapia Intensiva (UCI)',
  'Pediatría',
  'Traumatología y Ortopedia',
  'Cardiología',
  'Nefrología',
];

function buildInitialDoctorsCatalog(profile: ResidentProfile): AttendingPhysicianItem[] {
  const rawObjects = Array.isArray(profile.attendingPhysicians)
    ? profile.attendingPhysicians.filter(
        (d): d is AttendingPhysicianItem =>
          Boolean(d && typeof d === 'object' && typeof d.name === 'string')
      )
    : [];
  const rawStrings = [
    ...(Array.isArray(profile.attendingPhysiciansCatalog)
      ? profile.attendingPhysiciansCatalog
      : []),
    ...(Array.isArray(profile.attendingPhysicians)
      ? (profile.attendingPhysicians as unknown[]).filter(
          (x): x is string => typeof x === 'string'
        )
      : []),
  ];

  const merged: AttendingPhysicianItem[] = [...rawObjects];

  rawStrings.forEach((name, idx) => {
    const trimmed = (typeof name === 'string' ? name : '').trim();
    if (!trimmed) return;
    if (!merged.some((d) => d.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      const defaultMatch = defaultAttendingPhysicianItems.find(
        (d) => d.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      merged.push({
        id: defaultMatch?.id || `doc-sync-${idx}`,
        name: trimmed,
        color: defaultMatch?.color || PRESET_COLORS[idx % PRESET_COLORS.length],
      });
    }
  });

  return merged.length > 0 ? merged : defaultAttendingPhysicianItems;
}

function mergeTagsCatalog(profileTags?: string[]): string[] {
  if (Array.isArray(profileTags) && profileTags.length > 0) {
    return profileTags;
  }
  const combined = [...(profileTags || []), ...defaultAvailableTags];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of combined) {
    const clean = (t || '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  }
  return result;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  initialTab = 'institution',
  isAdmin = true,
  onRequestAdminMode,
  onSaveProfile,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);
  const wasOpenRef = useRef(false);
  const lastInitialTabRef = useRef<SettingsTabKey>(initialTab);

  // Hospital & Specialty State
  const [hospitalName, setHospitalName] = useState(profile.hospital);
  const [specialtyName, setSpecialtyName] = useState(profile.service);
  const [defaultAuthorName, setDefaultAuthorName] = useState(profile.name);

  // Attending Physicians (Médicos a Cargo) State
  const [doctors, setDoctors] = useState<AttendingPhysicianItem[]>(() =>
    buildInitialDoctorsCatalog(profile)
  );
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorColor, setNewDoctorColor] = useState('#2563eb');

  // Services Catalog State
  const [services, setServices] = useState<HospitalServiceItem[]>(
    profile.servicesCatalog && profile.servicesCatalog.length > 0
      ? profile.servicesCatalog
      : defaultServicesCatalog
  );
  const [pendingServices, setPendingServices] = useState<HospitalServiceItem[]>(
    profile.pendingUserServices || []
  );
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceColor, setNewServiceColor] = useState('#0d9488');

  // Clinical Tags State
  const [tags, setTags] = useState<string[]>(() => mergeTagsCatalog(profile.availableTags));
  const [pendingTags, setPendingTags] = useState<string[]>(profile.pendingUserTags || []);
  const [newTagText, setNewTagText] = useState('');

  // Nursing Orders State
  const [nursingOrders, setNursingOrders] = useState<string[]>(profile.nursingRepository || []);
  const [pendingOrders, setPendingOrders] = useState<string[]>(
    profile.pendingUserNursingOrders || []
  );
  const [newOrderText, setNewOrderText] = useState('');

  // Customizable Templates & Medication Routes State
  const [subjectivePresets, setSubjectivePresets] = useState<string[]>(
    profile.subjectivePresets && profile.subjectivePresets.length > 0
      ? profile.subjectivePresets
      : DEFAULT_SUBJECTIVE_PRESETS
  );
  const [newSubjectiveText, setNewSubjectiveText] = useState('');

  const [physicalExamTemplates, setPhysicalExamTemplates] = useState<PhysicalExamTemplateItem[]>(
    profile.physicalExamTemplates && profile.physicalExamTemplates.length > 0
      ? profile.physicalExamTemplates
      : DEFAULT_PHYSICAL_EXAM_TEMPLATES
  );
  const [newPeLabel, setNewPeLabel] = useState('');
  const [newPeText, setNewPeText] = useState('');

  const [dietPresets, setDietPresets] = useState<string[]>(
    profile.dietPresets && profile.dietPresets.length > 0
      ? profile.dietPresets
      : DEFAULT_DIET_PRESETS
  );
  const [newDietText, setNewDietText] = useState('');

  const [medicationRoutes, setMedicationRoutes] = useState<string[]>(
    profile.medicationRoutesCatalog && profile.medicationRoutesCatalog.length > 0
      ? profile.medicationRoutesCatalog
      : DEFAULT_MEDICATION_ROUTES
  );
  const [newRouteText, setNewRouteText] = useState('');

  const [ahfPresets, setAhfPresets] = useState<string[]>(
    profile.ahfPresets && profile.ahfPresets.length > 0
      ? profile.ahfPresets
      : DEFAULT_AHF_PRESETS
  );
  const [newAhfText, setNewAhfText] = useState('');

  const [apnpPresets, setApnpPresets] = useState<string[]>(
    profile.apnpPresets && profile.apnpPresets.length > 0
      ? profile.apnpPresets
      : DEFAULT_APNP_PRESETS
  );
  const [newApnpText, setNewApnpText] = useState('');

  const [appPresets, setAppPresets] = useState<string[]>(
    profile.appPresets && profile.appPresets.length > 0
      ? profile.appPresets
      : DEFAULT_APP_PRESETS
  );
  const [newAppText, setNewAppText] = useState('');

  // Hydrate state ONLY when the modal transitions from closed -> open (or when initialTab explicitly changes while opening).
  // Never reset activeTab when profile updates due to in-modal edits!
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      lastInitialTabRef.current = initialTab;
      setActiveTab(initialTab);
      setHospitalName(profile.hospital);
      setSpecialtyName(profile.service);
      setDefaultAuthorName(profile.name);
      setDoctors(buildInitialDoctorsCatalog(profile));
      setServices(
        profile.servicesCatalog && profile.servicesCatalog.length > 0
          ? profile.servicesCatalog
          : defaultServicesCatalog
      );
      setPendingServices(profile.pendingUserServices || []);
      setTags(mergeTagsCatalog(profile.availableTags));
      setPendingTags(profile.pendingUserTags || []);
      setNursingOrders(profile.nursingRepository || []);
      setPendingOrders(profile.pendingUserNursingOrders || []);
      setSubjectivePresets(
        profile.subjectivePresets && profile.subjectivePresets.length > 0
          ? profile.subjectivePresets
          : DEFAULT_SUBJECTIVE_PRESETS
      );
      setPhysicalExamTemplates(
        profile.physicalExamTemplates && profile.physicalExamTemplates.length > 0
          ? profile.physicalExamTemplates
          : DEFAULT_PHYSICAL_EXAM_TEMPLATES
      );
      setDietPresets(
        profile.dietPresets && profile.dietPresets.length > 0
          ? profile.dietPresets
          : DEFAULT_DIET_PRESETS
      );
      setMedicationRoutes(
        profile.medicationRoutesCatalog && profile.medicationRoutesCatalog.length > 0
          ? profile.medicationRoutesCatalog
          : DEFAULT_MEDICATION_ROUTES
      );
      setAhfPresets(
        profile.ahfPresets && profile.ahfPresets.length > 0
          ? profile.ahfPresets
          : DEFAULT_AHF_PRESETS
      );
      setApnpPresets(
        profile.apnpPresets && profile.apnpPresets.length > 0
          ? profile.apnpPresets
          : DEFAULT_APNP_PRESETS
      );
      setAppPresets(
        profile.appPresets && profile.appPresets.length > 0
          ? profile.appPresets
          : DEFAULT_APP_PRESETS
      );
    } else if (isOpen && initialTab !== lastInitialTabRef.current) {
      lastInitialTabRef.current = initialTab;
      setActiveTab(initialTab);
    } else if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
    }
  }, [isOpen, initialTab, profile]);

  const buildProfilePayload = (overrides?: {
    doctors?: AttendingPhysicianItem[];
    services?: HospitalServiceItem[];
    pendingServices?: HospitalServiceItem[];
    tags?: string[];
    pendingTags?: string[];
    nursingOrders?: string[];
    pendingOrders?: string[];
    subjectivePresets?: string[];
    physicalExamTemplates?: PhysicalExamTemplateItem[];
    dietPresets?: string[];
    medicationRoutes?: string[];
    ahfPresets?: string[];
    apnpPresets?: string[];
    appPresets?: string[];
  }): ResidentProfile => {
    const nextDoctors = overrides?.doctors ?? doctors;
    const nextServices = overrides?.services ?? services;
    const nextPendingServices = overrides?.pendingServices ?? pendingServices;
    const nextTags = overrides?.tags ?? tags;
    const nextPendingTags = overrides?.pendingTags ?? pendingTags;
    const nextNursing = overrides?.nursingOrders ?? nursingOrders;
    const nextPendingOrders = overrides?.pendingOrders ?? pendingOrders;
    const nextSubjective = overrides?.subjectivePresets ?? subjectivePresets;
    const nextPeTemplates = overrides?.physicalExamTemplates ?? physicalExamTemplates;
    const nextDietPresets = overrides?.dietPresets ?? dietPresets;
    const nextMedRoutes = overrides?.medicationRoutes ?? medicationRoutes;
    const nextAhf = overrides?.ahfPresets ?? ahfPresets;
    const nextApnp = overrides?.apnpPresets ?? apnpPresets;
    const nextApp = overrides?.appPresets ?? appPresets;

    return {
      ...profile,
      name: defaultAuthorName.trim() || profile.name,
      hospital: hospitalName.trim() || profile.hospital,
      service: specialtyName.trim() || profile.service,
      attendingPhysicians: nextDoctors,
      attendingPhysiciansCatalog: nextDoctors.map((d) => d.name),
      servicesCatalog: nextServices,
      availableTags: nextTags,
      nursingRepository: nextNursing,
      pendingUserServices: nextPendingServices,
      pendingUserTags: nextPendingTags,
      pendingUserNursingOrders: nextPendingOrders,
      subjectivePresets: nextSubjective,
      physicalExamTemplates: nextPeTemplates,
      dietPresets: nextDietPresets,
      medicationRoutesCatalog: nextMedRoutes,
      ahfPresets: nextAhf,
      apnpPresets: nextApnp,
      appPresets: nextApp,
    };
  };

  // Auto-save whenever user closes via Escape or top-right X so no changes are ever lost
  const handleCloseAndSync = () => {
    onSaveProfile(buildProfilePayload());
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        handleCloseAndSync();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!isOpen) return null;

  // Doctors Handlers
  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDoctorName.trim();
    if (!trimmed) return;
    if (doctors.some((d) => d.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Este médico ya está registrado en el catálogo.');
      return;
    }
    const newDoc: AttendingPhysicianItem = {
      id: `doc-${Date.now()}`,
      name: trimmed,
      color: newDoctorColor,
    };
    const nextDoctors = [...doctors, newDoc];
    setDoctors(nextDoctors);
    onSaveProfile(buildProfilePayload({ doctors: nextDoctors }));
    setNewDoctorName('');
    showToast(`Médico "${trimmed}" registrado con color personalizado.`);
  };

  const handleUpdateDoctorColor = (id: string, color: string) => {
    const nextDoctors = doctors.map((d) => (d.id === id ? { ...d, color } : d));
    setDoctors(nextDoctors);
    onSaveProfile(buildProfilePayload({ doctors: nextDoctors }));
  };

  const handleUpdateDoctorName = (id: string, name: string) => {
    const nextDoctors = doctors.map((d) => (d.id === id ? { ...d, name } : d));
    setDoctors(nextDoctors);
    onSaveProfile(buildProfilePayload({ doctors: nextDoctors }));
  };

  const handleDeleteDoctor = (id: string) => {
    if (doctors.length <= 1) {
      showToast('Debe existir al menos un médico adscrito en el catálogo.');
      return;
    }
    const nextDoctors = doctors.filter((d) => d.id !== id);
    setDoctors(nextDoctors);
    onSaveProfile(buildProfilePayload({ doctors: nextDoctors }));
    showToast('Médico eliminado del catálogo.');
  };

  const handleResetDoctors = () => {
    setDoctors(defaultAttendingPhysicianItems);
    onSaveProfile(buildProfilePayload({ doctors: defaultAttendingPhysicianItems }));
    showToast('Catálogo de médicos restaurado por defecto.');
  };

  // Services Handlers
  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newServiceName.trim();
    if (!trimmed) return;
    if (services.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Ya existe un servicio con ese nombre.');
      return;
    }

    const newService: HospitalServiceItem = {
      id: `srv-${Date.now()}`,
      name: trimmed,
      color: newServiceColor,
    };
    const nextServices = [...services, newService];
    const nextPendingServices = !isAdmin ? [...pendingServices, newService] : pendingServices;
    setServices(nextServices);
    setPendingServices(nextPendingServices);
    onSaveProfile(
      buildProfilePayload({ services: nextServices, pendingServices: nextPendingServices })
    );
    showToast(`Servicio "${trimmed}" agregado.`);
    setNewServiceName('');
  };

  const handleApprovePendingService = (srvId: string) => {
    const nextPending = pendingServices.filter((s) => s.id !== srvId);
    setPendingServices(nextPending);
    onSaveProfile(buildProfilePayload({ pendingServices: nextPending }));
    showToast('Servicio implementado de forma permanente por el Administrador.');
  };

  const handleUpdateServiceColor = (id: string, color: string) => {
    const nextServices = services.map((s) => (s.id === id ? { ...s, color } : s));
    setServices(nextServices);
    onSaveProfile(buildProfilePayload({ services: nextServices }));
  };

  const handleUpdateServiceName = (id: string, name: string) => {
    const nextServices = services.map((s) => (s.id === id ? { ...s, name } : s));
    setServices(nextServices);
    onSaveProfile(buildProfilePayload({ services: nextServices }));
  };

  const handleDeleteService = (id: string) => {
    if (services.length <= 1) {
      showToast('Debe haber al menos un servicio configurado.');
      return;
    }
    const nextServices = services.filter((s) => s.id !== id);
    const nextPending = pendingServices.filter((s) => s.id !== id);
    setServices(nextServices);
    setPendingServices(nextPending);
    onSaveProfile(buildProfilePayload({ services: nextServices, pendingServices: nextPending }));
    showToast('Servicio eliminado del catálogo.');
  };

  const handleResetServices = () => {
    setServices(defaultServicesCatalog);
    onSaveProfile(buildProfilePayload({ services: defaultServicesCatalog }));
    showToast('Servicios restaurados a los valores por defecto.');
  };

  // Tags Handlers
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagText.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Esta etiqueta ya existe en el catálogo.');
      return;
    }
    const nextTags = [...tags, trimmed];
    const nextPendingTags = !isAdmin ? [...pendingTags, trimmed] : pendingTags;
    setTags(nextTags);
    setPendingTags(nextPendingTags);
    onSaveProfile(buildProfilePayload({ tags: nextTags, pendingTags: nextPendingTags }));
    showToast(`Etiqueta "${trimmed}" agregada y sincronizada en todo el sistema.`);
    setNewTagText('');
  };

  const handleUpdateTag = (index: number, newVal: string) => {
    const nextTags = tags.map((t, idx) => (idx === index ? newVal : t));
    setTags(nextTags);
    onSaveProfile(buildProfilePayload({ tags: nextTags }));
  };

  const handleApprovePendingTag = (tag: string) => {
    const nextPending = pendingTags.filter((t) => t !== tag);
    setPendingTags(nextPending);
    onSaveProfile(buildProfilePayload({ pendingTags: nextPending }));
    showToast(`Etiqueta "${tag}" aprobada como permanente.`);
  };

  const handleDeleteTag = (tagToDelete: string) => {
    const nextTags = tags.filter((t) => t !== tagToDelete);
    const nextPending = pendingTags.filter((t) => t !== tagToDelete);
    setTags(nextTags);
    setPendingTags(nextPending);
    onSaveProfile(buildProfilePayload({ tags: nextTags, pendingTags: nextPending }));
  };

  // Nursing Orders Handlers
  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOrderText.trim();
    if (!trimmed) return;
    const nextOrders = [...nursingOrders, trimmed];
    const nextPending = !isAdmin ? [...pendingOrders, trimmed] : pendingOrders;
    setNursingOrders(nextOrders);
    setPendingOrders(nextPending);
    onSaveProfile(buildProfilePayload({ nursingOrders: nextOrders, pendingOrders: nextPending }));
    showToast('Orden agregada al catálogo de enfermería.');
    setNewOrderText('');
  };

  const handleUpdateOrder = (index: number, newVal: string) => {
    const nextOrders = nursingOrders.map((o, idx) => (idx === index ? newVal : o));
    setNursingOrders(nextOrders);
    onSaveProfile(buildProfilePayload({ nursingOrders: nextOrders }));
  };

  const handleApprovePendingOrder = (ord: string) => {
    const nextPending = pendingOrders.filter((o) => o !== ord);
    setPendingOrders(nextPending);
    onSaveProfile(buildProfilePayload({ pendingOrders: nextPending }));
    showToast('Orden de enfermería aprobada permanentemente.');
  };

  const handleDeleteOrder = (index: number) => {
    const ord = nursingOrders[index];
    const nextOrders = nursingOrders.filter((_, idx) => idx !== index);
    const nextPending = pendingOrders.filter((o) => o !== ord);
    setNursingOrders(nextOrders);
    setPendingOrders(nextPending);
    onSaveProfile(buildProfilePayload({ nursingOrders: nextOrders, pendingOrders: nextPending }));
  };

  // Templates & Routes Handlers
  const handleAddSubjective = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubjectiveText.trim();
    if (!trimmed) return;
    const next = [...subjectivePresets, trimmed];
    setSubjectivePresets(next);
    onSaveProfile(buildProfilePayload({ subjectivePresets: next }));
    setNewSubjectiveText('');
    showToast('Opción de evolución sintomática agregada.');
  };

  const handleUpdateSubjective = (idx: number, val: string) => {
    const next = subjectivePresets.map((item, i) => (i === idx ? val : item));
    setSubjectivePresets(next);
    onSaveProfile(buildProfilePayload({ subjectivePresets: next }));
  };

  const handleDeleteSubjective = (idx: number) => {
    const next = subjectivePresets.filter((_, i) => i !== idx);
    setSubjectivePresets(next);
    onSaveProfile(buildProfilePayload({ subjectivePresets: next }));
  };

  const handleAddPeTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const labelTrim = newPeLabel.trim();
    const textTrim = newPeText.trim();
    if (!labelTrim || !textTrim) return;
    const next: PhysicalExamTemplateItem[] = [
      ...physicalExamTemplates,
      { id: `pe-${Date.now()}`, label: labelTrim, text: textTrim },
    ];
    setPhysicalExamTemplates(next);
    onSaveProfile(buildProfilePayload({ physicalExamTemplates: next }));
    setNewPeLabel('');
    setNewPeText('');
    showToast(`Plantilla "${labelTrim}" agregada a Exploración Física.`);
  };

  const handleUpdatePeTemplate = (id: string, field: 'label' | 'text', val: string) => {
    const next = physicalExamTemplates.map((t) => (t.id === id ? { ...t, [field]: val } : t));
    setPhysicalExamTemplates(next);
    onSaveProfile(buildProfilePayload({ physicalExamTemplates: next }));
  };

  const handleDeletePeTemplate = (id: string) => {
    const next = physicalExamTemplates.filter((t) => t.id !== id);
    setPhysicalExamTemplates(next);
    onSaveProfile(buildProfilePayload({ physicalExamTemplates: next }));
  };

  const handleAddDietPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDietText.trim();
    if (!trimmed) return;
    const next = [...dietPresets, trimmed];
    setDietPresets(next);
    onSaveProfile(buildProfilePayload({ dietPresets: next }));
    setNewDietText('');
    showToast('Opción rápida de dieta agregada.');
  };

  const handleUpdateDietPreset = (idx: number, val: string) => {
    const next = dietPresets.map((d, i) => (i === idx ? val : d));
    setDietPresets(next);
    onSaveProfile(buildProfilePayload({ dietPresets: next }));
  };

  const handleDeleteDietPreset = (idx: number) => {
    const next = dietPresets.filter((_, i) => i !== idx);
    setDietPresets(next);
    onSaveProfile(buildProfilePayload({ dietPresets: next }));
  };

  const handleAddMedicationRoute = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newRouteText.trim();
    if (!trimmed) return;
    if (medicationRoutes.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Esta vía de administración ya está registrada.');
      return;
    }
    const next = [...medicationRoutes, trimmed];
    setMedicationRoutes(next);
    onSaveProfile(buildProfilePayload({ medicationRoutes: next }));
    setNewRouteText('');
    showToast(`Vía de administración "${trimmed}" agregada.`);
  };

  const handleUpdateMedicationRoute = (idx: number, val: string) => {
    const next = medicationRoutes.map((r, i) => (i === idx ? val : r));
    setMedicationRoutes(next);
    onSaveProfile(buildProfilePayload({ medicationRoutes: next }));
  };

  const handleDeleteMedicationRoute = (idx: number) => {
    if (medicationRoutes.length <= 1) return;
    const next = medicationRoutes.filter((_, i) => i !== idx);
    setMedicationRoutes(next);
    onSaveProfile(buildProfilePayload({ medicationRoutes: next }));
  };

  const handleResetAllTemplates = () => {
    setSubjectivePresets(DEFAULT_SUBJECTIVE_PRESETS);
    setPhysicalExamTemplates(DEFAULT_PHYSICAL_EXAM_TEMPLATES);
    setDietPresets(DEFAULT_DIET_PRESETS);
    setMedicationRoutes(DEFAULT_MEDICATION_ROUTES);
    setAhfPresets(DEFAULT_AHF_PRESETS);
    setApnpPresets(DEFAULT_APNP_PRESETS);
    setAppPresets(DEFAULT_APP_PRESETS);
    onSaveProfile(
      buildProfilePayload({
        subjectivePresets: DEFAULT_SUBJECTIVE_PRESETS,
        physicalExamTemplates: DEFAULT_PHYSICAL_EXAM_TEMPLATES,
        dietPresets: DEFAULT_DIET_PRESETS,
        medicationRoutes: DEFAULT_MEDICATION_ROUTES,
        ahfPresets: DEFAULT_AHF_PRESETS,
        apnpPresets: DEFAULT_APNP_PRESETS,
        appPresets: DEFAULT_APP_PRESETS,
      })
    );
    showToast('Plantillas y vías de administración restauradas a valores originales.');
  };

  const handleSaveAll = () => {
    onSaveProfile(buildProfilePayload());
    showToast('Preferencias y catálogos actualizados.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-xl">
              <Settings className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold leading-tight flex items-center gap-2">
              <span>Preferencias y Configuración del Sistema</span>
              <InfoPopover content="Configura el hospital, especialidad, médicos a cargo con su color distintivo, servicios, banco de etiquetas clínicas, órdenes de enfermería, vías de administración y plantillas de autorrelleno. Todos los cambios se sincronizan en tiempo real." />
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin && onRequestAdminMode && (
              <button
                type="button"
                onClick={onRequestAdminMode}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Activar Administrador</span>
              </button>
            )}
            <button
              onClick={handleCloseAndSync}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Cerrar y sincronizar (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Cerrar</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('institution')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'institution'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Hospital y Especialidad</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('doctors')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'doctors'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Médicos a Cargo ({doctors.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'services'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Servicios ({services.length})</span>
            {pendingServices.length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 rounded-full font-extrabold">
                +{pendingServices.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tags')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tags'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Etiquetas ({tags.length})</span>
            {pendingTags.length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 rounded-full font-extrabold">
                +{pendingTags.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('nursing')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'nursing'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Órdenes Enfermería ({nursingOrders.length})</span>
            {pendingOrders.length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 rounded-full font-extrabold">
                +{pendingOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'templates'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Plantillas, Autorrelleno y Vías</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* TAB 0: HOSPITAL & SPECIALTY */}
          {activeTab === 'institution' && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Sede Hospitalaria y Especialidad del Censo
                </h3>
                <InfoPopover content="Permite adaptar el censo para cualquier hospital y especialidad médica (Medicina Interna, Cirugía General, Ginecología y Obstetricia, UCI, etc.)." />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/70 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Hospital / Unidad Médica
                  </label>
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder="Ej. HGZ No. 1, Hospital Central, CMN..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Especialidad / Departamento Principal
                  </label>
                  <input
                    type="text"
                    value={specialtyName}
                    onChange={(e) => setSpecialtyName(e.target.value)}
                    placeholder="Ej. Medicina Interna, Ginecología, Cirugía"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className="text-[10.5px] font-semibold text-slate-500 block mb-1.5">
                    Selección rápida de especialidad:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SPECIALTY_PRESETS.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setSpecialtyName(sp)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                          specialtyName === sp
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500'
                        }`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Tu Nombre (Usuario Activo en este Turno)
                  </label>
                  <input
                    type="text"
                    value={defaultAuthorName}
                    onChange={(e) => setDefaultAuthorName(e.target.value)}
                    placeholder="Ej. Dr. Juan Pérez / MIP María Gómez"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: ATTENDING PHYSICIANS (MÉDICOS A CARGO) & COLORS */}
          {activeTab === 'doctors' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Catálogo de Médicos Adscritos / A Cargo
                  </h3>
                  <InfoPopover
                    title="Médicos a Cargo y Color Distintivo"
                    content="Registra a los médicos adscritos o tratantes y asígnales un color personalizado. En el Censo Activo y en el ingreso de pacientes podrás asignarlos directamente con su distintivo de color sin ruido visual."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResetDoctors}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar por defecto</span>
                </button>
              </div>

              {/* Form to Add New Attending Physician */}
              <form
                onSubmit={handleAddDoctor}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 w-full">
                    <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Nombre y Especialidad del Médico a Cargo *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Dr. Carlos Mendoza (M.I. / Cardiología)"
                      value={newDoctorName}
                      onChange={(e) => setNewDoctorName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="shrink-0">
                    <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Color Distintivo
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newDoctorColor}
                        onChange={(e) => setNewDoctorColor(e.target.value)}
                        className="w-9 h-8 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="sm:self-end">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Médico</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold">Paleta rápida:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewDoctorColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                          newDoctorColor.toLowerCase() === c.toLowerCase()
                            ? 'scale-125 border-black dark:border-white shadow-xs'
                            : 'border-white/40 hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </form>

              <div className="space-y-2">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <input
                        type="color"
                        value={doc.color}
                        onChange={(e) => handleUpdateDoctorColor(doc.id, e.target.value)}
                        title="Cambiar color distintivo del médico"
                        className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-900 shrink-0"
                      />
                      <div className="flex flex-wrap gap-1 shrink-0 hidden sm:flex">
                        {PRESET_COLORS.slice(0, 6).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleUpdateDoctorColor(doc.id, c)}
                            style={{ backgroundColor: c }}
                            className={`w-3.5 h-3.5 rounded-full border cursor-pointer ${
                              doc.color.toLowerCase() === c.toLowerCase()
                                ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                      <input
                        type="text"
                        value={doc.name}
                        onChange={(e) => handleUpdateDoctorName(doc.id, e.target.value)}
                        className="flex-1 min-w-0 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold text-xs"
                      />
                      <span
                        style={{
                          backgroundColor: `${doc.color}18`,
                          borderColor: `${doc.color}66`,
                          color: doc.color,
                        }}
                        className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-extrabold shrink-0"
                      >
                        <Stethoscope className="w-3 h-3" />
                        Vista previa
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteDoctor(doc.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Eliminar médico del catálogo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: SERVICES & COLORS */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Catálogo de Servicios Hospitalarios
                  </h3>
                  <InfoPopover content="Asigna un color específico a cada servicio o pabellón. Puedes editar el nombre, cambiar su color o agregar nuevos servicios en cualquier momento." />
                </div>
                <button
                  type="button"
                  onClick={handleResetServices}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar por defecto</span>
                </button>
              </div>

              {/* Form to Add New Service */}
              <form
                onSubmit={handleAddService}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 w-full">
                    <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Nombre del Nuevo Servicio o Pabellón *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Infectología, Ginecología Piso 2, Cirugía Hombres"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="shrink-0">
                    <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newServiceColor}
                        onChange={(e) => setNewServiceColor(e.target.value)}
                        className="w-9 h-8 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="sm:self-end">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold">Colores:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewServiceColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                          newServiceColor.toLowerCase() === c.toLowerCase()
                            ? 'scale-125 border-black dark:border-white shadow-xs'
                            : 'border-white/40 hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </form>

              <div className="space-y-2">
                {services.map((srv) => {
                  const isSuggested = pendingServices.some((p) => p.id === srv.id);
                  return (
                    <div
                      key={srv.id}
                      className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 flex-1 w-full">
                        <input
                          type="color"
                          value={srv.color}
                          onChange={(e) => handleUpdateServiceColor(srv.id, e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-900"
                        />
                        <div className="flex flex-wrap gap-1 shrink-0 hidden sm:flex">
                          {PRESET_COLORS.slice(0, 6).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleUpdateServiceColor(srv.id, c)}
                              style={{ backgroundColor: c }}
                              className={`w-3.5 h-3.5 rounded-full border cursor-pointer ${
                                srv.color.toLowerCase() === c.toLowerCase()
                                  ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                            />
                          ))}
                        </div>
                        <input
                          type="text"
                          value={srv.name}
                          onChange={(e) => handleUpdateServiceName(srv.id, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isSuggested && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Sugerido por usuario
                          </span>
                        )}
                        {isSuggested && isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleApprovePendingService(srv.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Aprobar Permanente
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteService(srv.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar servicio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CLINICAL TAGS */}
          {activeTab === 'tags' && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Banco Sincronizado de Marcadores y Etiquetas Clínicas
                </h3>
                <InfoPopover content="Todas las etiquetas de este banco aparecen sincronizadas en el Censo Activo, en el Expediente Clínico y en el Formulario de Ingreso de Pacientes. Puedes editar su nombre o eliminarlas." />
              </div>

              <form onSubmit={handleAddTag} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. Diálisis Peritoneal, Traqueostomía, Neutropenia, CPAP / BiPAP"
                  value={newTagText}
                  onChange={(e) => setNewTagText(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Etiqueta</span>
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {tags.map((tag, idx) => {
                  const isPending = pendingTags.includes(tag);
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                        isPending
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="text"
                        value={tag}
                        onChange={(e) => handleUpdateTag(idx, e.target.value)}
                        className="flex-1 min-w-0 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100"
                      />
                      {isPending && (
                        <span className="text-[9px] bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 px-1 rounded font-bold shrink-0">
                          Sugerida
                        </span>
                      )}
                      {isPending && isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleApprovePendingTag(tag)}
                          title="Hacer permanente"
                          className="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer p-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(tag)}
                        title="Eliminar etiqueta"
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: NURSING ORDERS */}
          {activeTab === 'nursing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Banco de Órdenes Frecuentes de Enfermería
                </h3>
                <InfoPopover content="Plantillas seleccionables al redactar la nota de evolución o al ingresar un paciente. Puedes editar el texto de cualquier orden existente o agregar nuevas." />
              </div>

              <form onSubmit={handleAddOrder} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. Control estricto de temperatura horaria por medios físicos"
                  value={newOrderText}
                  onChange={(e) => setNewOrderText(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Orden</span>
                </button>
              </form>

              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {nursingOrders.map((ord, idx) => {
                  const isPending = pendingOrders.includes(ord);
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                        isPending
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
                        <input
                          type="text"
                          value={ord}
                          onChange={(e) => handleUpdateOrder(idx, e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 text-xs font-medium"
                        />
                        {isPending && (
                          <span className="text-[9px] bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded font-bold shrink-0">
                            Sugerida
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPending && isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleApprovePendingOrder(ord)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Aprobar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(idx)}
                          title="Eliminar orden de enfermería"
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOMIZABLE TEMPLATES, AUTOFILL & MEDICATION ROUTES */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Personalización de Opciones Pre-hechas, Autorrelleno y Vías de Administración
                  </h3>
                  <InfoPopover content="Edita la redacción de las opciones pre-hechas o agrega nuevas según las necesidades de tu servicio hospitalario. Se reflejan inmediatamente en el Generador de Notas, Ingreso y Expediente." />
                </div>
                <button
                  type="button"
                  onClick={handleResetAllTemplates}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar todas las plantillas</span>
                </button>
              </div>

              {/* SECTION A: SUBJECTIVE & SYMPTOMATIC EVOLUTION */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    1. Subjetivo y Evolución Sintomática (Opciones Múltiples en Nota)
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {subjectivePresets.length} opciones
                  </span>
                </div>

                <form onSubmit={handleAddSubjective} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nueva frase rápida para Subjetivo (ej. Canaliza gases, sin náusea ni vómito.)"
                    value={newSubjectiveText}
                    onChange={(e) => setNewSubjectiveText(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </form>

                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {subjectivePresets.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleUpdateSubjective(idx, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteSubjective(idx)}
                        title="Eliminar opción"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION B: PHYSICAL EXAM TEMPLATES */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    2. Formatos Pre-hechos de Exploración Física
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {physicalExamTemplates.length} plantillas
                  </span>
                </div>

                <form
                  onSubmit={handleAddPeTemplate}
                  className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del botón (ej. EF Quirúrgico / Postoperado)"
                      value={newPeLabel}
                      onChange={(e) => setNewPeLabel(e.target.value)}
                      className="sm:w-64 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Redacción clínica completa de la exploración física..."
                      value={newPeText}
                      onChange={(e) => setNewPeText(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Plantilla</span>
                    </button>
                  </div>
                </form>

                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {physicalExamTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={tpl.label}
                          onChange={(e) => handleUpdatePeTemplate(tpl.id, 'label', e.target.value)}
                          placeholder="Título corto del formato"
                          className="w-64 px-2.5 py-1 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded text-xs font-bold text-blue-900 dark:text-blue-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePeTemplate(tpl.id)}
                          title="Eliminar plantilla de exploración física"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={tpl.text}
                        onChange={(e) => handleUpdatePeTemplate(tpl.id, 'text', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-100 leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION C: MEDICATION ADMINISTRATION ROUTES */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    3. Repertorio de Vías de Administración de Medicamentos
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {medicationRoutes.length} vías disponibles
                  </span>
                </div>

                <form onSubmit={handleAddMedicationRoute} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nueva vía de administración (ej. Intraarticular, Nebulizado continuo, Gastrostomía...)"
                    value={newRouteText}
                    onChange={(e) => setNewRouteText(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Vía</span>
                  </button>
                </form>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {medicationRoutes.map((route, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                    >
                      <input
                        type="text"
                        value={route}
                        onChange={(e) => handleUpdateMedicationRoute(idx, e.target.value)}
                        className="flex-1 min-w-0 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteMedicationRoute(idx)}
                        title="Eliminar vía"
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION D: DIET QUICK PRESETS */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    4. Opciones Rápidas de Dieta e Hidratación Enteral
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {dietPresets.length} opciones
                  </span>
                </div>

                <form onSubmit={handleAddDietPreset} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nueva opción de dieta (ej. Dieta astringente sin lácteos ni irritantes)"
                    value={newDietText}
                    onChange={(e) => setNewDietText(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Dieta</span>
                  </button>
                </form>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {dietPresets.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleUpdateDietPreset(idx, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteDietPreset(idx)}
                        title="Eliminar dieta"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION E: CLINICAL HISTORY (NOM-004) AUTOFILL CHIPS */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-4">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  5. Frases Pre-hechas para Historia Clínica (AHF, APNP, APP)
                </h4>

                {/* AHF */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Antecedentes Heredofamiliares (AHF):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Agregar frase de AHF..."
                      value={newAhfText}
                      onChange={(e) => setNewAhfText(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newAhfText.trim()) return;
                        const next = [...ahfPresets, newAhfText.trim()];
                        setAhfPresets(next);
                        onSaveProfile(buildProfilePayload({ ahfPresets: next }));
                        setNewAhfText('');
                      }}
                      className="px-3 py-1 bg-slate-800 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      + AHF
                    </button>
                  </div>
                  {ahfPresets.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = ahfPresets.map((a, i) => (i === idx ? e.target.value : a));
                          setAhfPresets(next);
                          onSaveProfile(buildProfilePayload({ ahfPresets: next }));
                        }}
                        className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = ahfPresets.filter((_, i) => i !== idx);
                          setAhfPresets(next);
                          onSaveProfile(buildProfilePayload({ ahfPresets: next }));
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* APNP */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Antecedentes Personales No Patológicos (APNP):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Agregar frase de APNP..."
                      value={newApnpText}
                      onChange={(e) => setNewApnpText(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newApnpText.trim()) return;
                        const next = [...apnpPresets, newApnpText.trim()];
                        setApnpPresets(next);
                        onSaveProfile(buildProfilePayload({ apnpPresets: next }));
                        setNewApnpText('');
                      }}
                      className="px-3 py-1 bg-slate-800 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      + APNP
                    </button>
                  </div>
                  {apnpPresets.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = apnpPresets.map((a, i) => (i === idx ? e.target.value : a));
                          setApnpPresets(next);
                          onSaveProfile(buildProfilePayload({ apnpPresets: next }));
                        }}
                        className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = apnpPresets.filter((_, i) => i !== idx);
                          setApnpPresets(next);
                          onSaveProfile(buildProfilePayload({ apnpPresets: next }));
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* APP */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Antecedentes Personales Patológicos (APP):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Agregar frase de APP..."
                      value={newAppText}
                      onChange={(e) => setNewAppText(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newAppText.trim()) return;
                        const next = [...appPresets, newAppText.trim()];
                        setAppPresets(next);
                        onSaveProfile(buildProfilePayload({ appPresets: next }));
                        setNewAppText('');
                      }}
                      className="px-3 py-1 bg-slate-800 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      + APP
                    </button>
                  </div>
                  {appPresets.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = appPresets.map((a, i) => (i === idx ? e.target.value : a));
                          setAppPresets(next);
                          onSaveProfile(buildProfilePayload({ appPresets: next }));
                        }}
                        className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = appPresets.filter((_, i) => i !== idx);
                          setAppPresets(next);
                          onSaveProfile(buildProfilePayload({ appPresets: next }));
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCloseAndSync}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Guardar y Sincronizar Preferencias</span>
          </button>
        </div>
      </div>
    </div>
  );
};
