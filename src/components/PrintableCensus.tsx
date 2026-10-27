import React, { useState, useRef } from 'react';
import {
  Printer,
  Filter,
  FileSpreadsheet,
  Layers,
  FileDown,
  SlidersHorizontal,
  X,
  Eye,
  Stethoscope,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, ResidentProfile } from '../types/clinical.ts';
import {
  calculateHospitalStayDays,
  calculateAntibioticDay,
  getCodeStatusInfo,
  getRespiratorySupportFlags,
  getNonRedundantClinicalTags,
  getDoctorColorInfo,
  formatCriticalCareSystemsSummary,
  formatParenteralSolutionLine,
  sanitizePdfText,
  hexToRgb,
  tintRgb,
} from '../utils/clinicalLogic.ts';
import {
  defaultServicesCatalog,
  defaultAttendingPhysicians,
  defaultAttendingPhysicianItems,
} from '../data/seedPatients.ts';
import { InfoPopover } from './InfoPopover.tsx';

interface PrintableCensusProps {
  patients: Patient[];
  profile: ResidentProfile;
  onShowToast?: (msg: string) => void;
}

export const PrintableCensus: React.FC<PrintableCensusProps> = ({
  patients,
  profile,
  onShowToast,
}) => {
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [includeDischarged, setIncludeDischarged] = useState<boolean>(false);
  const [marginPreset, setMarginPreset] = useState<'8' | '10' | '14' | 'custom'>('10');
  const [customMarginMm, setCustomMarginMm] = useState<number>(10);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Print Portal / Sheet Preview Modal state
  const [isPrintPortalOpen, setIsPrintPortalOpen] = useState<boolean>(false);
  const [portalViewMode, setPortalViewMode] = useState<'html' | 'pdf'>('html');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const activeMarginMm =
    marginPreset === 'custom' ? Math.max(4, Math.min(25, customMarginMm)) : Number(marginPreset);

  const doctorsCatalogItems =
    profile.attendingPhysicians && profile.attendingPhysicians.length > 0
      ? profile.attendingPhysicians
      : defaultAttendingPhysicianItems;

  const availableDoctors = Array.from(
    new Set([
      ...(profile.attendingPhysiciansCatalog && profile.attendingPhysiciansCatalog.length > 0
        ? profile.attendingPhysiciansCatalog
        : defaultAttendingPhysicians),
      ...doctorsCatalogItems.map((d) => d.name),
      ...patients.map((p) => p.attendingPhysician).filter((d): d is string => Boolean(d && d.trim())),
    ])
  );

  const activePatients = patients.filter((p) => {
    if (!includeDischarged && p.status === 'discharged') return false;
    if (serviceFilter !== 'all' && p.service !== serviceFilter) return false;
    if (doctorFilter !== 'all' && (p.attendingPhysician || '') !== doctorFilter) return false;
    return true;
  });

  // Helper to format labs + cabinet studies compactly for PDF
  const formatCompactParaclinicsText = (patient: Patient): string => {
    const latestLab = patient.labs && patient.labs.length > 0 ? patient.labs[0] : null;
    const prevLab = patient.labs && patient.labs.length > 1 ? patient.labs[1] : null;
    const studiesList = patient.studies || [];
    const lines: string[] = [];

    if (latestLab) {
      const parts: string[] = [];
      if (latestLab.hb !== undefined) parts.push(`Hb:${latestLab.hb}`);
      if (latestLab.leucos !== undefined)
        parts.push(`L:${(latestLab.leucos / 1000).toFixed(1)}k`);
      if (latestLab.plaquetas !== undefined)
        parts.push(`Plq:${(latestLab.plaquetas / 1000).toFixed(0)}k`);
      if (latestLab.glucosa !== undefined) parts.push(`Gluc:${latestLab.glucosa}`);
      if (latestLab.creatinina !== undefined) parts.push(`Cr:${latestLab.creatinina}`);
      if (latestLab.bun !== undefined) parts.push(`BUN:${latestLab.bun}`);
      if (latestLab.na !== undefined) parts.push(`Na:${latestLab.na}`);
      if (latestLab.k !== undefined) parts.push(`K:${latestLab.k}`);
      if (latestLab.cl !== undefined) parts.push(`Cl:${latestLab.cl}`);
      if (latestLab.ph !== undefined) parts.push(`pH:${latestLab.ph}`);
      if (latestLab.lactato !== undefined) parts.push(`Lac:${latestLab.lactato}`);
      if (latestLab.extraParams) {
        Object.values(latestLab.extraParams)
          .slice(0, 5)
          .forEach((ep) => parts.push(`${ep.label}:${ep.value}`));
      }

      lines.push(`HOY(${latestLab.date.slice(5)}): ${parts.join(' | ')}`);

      if (prevLab) {
        const prevParts: string[] = [];
        if (prevLab.hb !== undefined) prevParts.push(`Hb:${prevLab.hb}`);
        if (prevLab.leucos !== undefined)
          prevParts.push(`L:${(prevLab.leucos / 1000).toFixed(1)}k`);
        if (prevLab.creatinina !== undefined) prevParts.push(`Cr:${prevLab.creatinina}`);
        if (prevLab.na !== undefined || prevLab.k !== undefined) {
          prevParts.push(`Na/K:${prevLab.na ?? '-'}/${prevLab.k ?? '-'}`);
        }
        if (prevParts.length > 0) {
          lines.push(`PREV(${prevLab.date.slice(5)}): ${prevParts.join(' | ')}`);
        }
      }
    }

    if (studiesList.length > 0) {
      studiesList.slice(0, 2).forEach((st) => {
        lines.push(`[${st.category} ${st.date.slice(5)}] ${st.title}: ${st.summary}`);
      });
    }

    return sanitizePdfText(lines.length > 0 ? lines.join('\n') : '-');
  };

  // Helper to draw a compact rounded colored pill badge in jsPDF and return its width
  const drawPdfBadge = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    fillRgb: [number, number, number],
    textRgb: [number, number, number],
    borderRgb?: [number, number, number],
    fontSize: number = 5.8
  ): number => {
    const clean = sanitizePdfText(text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(clean);
    const padX = 1.1;
    const badgeW = textWidth + padX * 2;
    const badgeH = 3.1;

    doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
    if (borderRgb) {
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.setLineWidth(0.15);
      doc.roundedRect(x, y, badgeW, badgeH, 0.6, 0.6, 'FD');
    } else {
      doc.roundedRect(x, y, badgeW, badgeH, 0.6, 0.6, 'F');
    }

    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
    doc.text(clean, x + padX, y + 2.25);
    return badgeW;
  };

  // Build Full-Color jsPDF document with exact Letter Landscape (279.4 x 215.9 mm) & Colored Table Badges
  const buildPdfDocument = (): jsPDF => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter',
    });

    const today = new Date().toISOString().split('T')[0];
    const hospitalTitle = sanitizePdfText((profile.hospital || 'HOSPITAL GENERAL').toUpperCase());
    const serviceTitle = sanitizePdfText(
      (serviceFilter === 'all' ? profile.service || 'TODOS LOS SERVICIOS' : serviceFilter).toUpperCase()
    );
    const doctorSubtitle =
      doctorFilter !== 'all' ? ` | ADSCRITO: ${sanitizePdfText(doctorFilter.toUpperCase())}` : '';

    const printableWidthMm = 279.4 - activeMarginMm * 2;

    // Color Header Banner
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(activeMarginMm, activeMarginMm - 0.5, printableWidthMm, 5.2, 0.8, 0.8, 'F');
    doc.setFillColor(13, 148, 136);
    doc.rect(activeMarginMm, activeMarginMm - 0.5, 2.2, 5.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(255, 255, 255);
    doc.text(
      sanitizePdfText(
        `CENSO CLINICO EN ORDEN DE PASE DE VISITA - ${hospitalTitle} - ${serviceTitle}${doctorSubtitle}`
      ),
      activeMarginMm + 3.5,
      activeMarginMm + 2.9
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(153, 246, 228);
    doc.text(
      sanitizePdfText(
        `${today} | ${activePatients.length} PACIENTES | MARGEN ${activeMarginMm}MM`
      ),
      279.4 - activeMarginMm - 1.8,
      activeMarginMm + 2.9,
      { align: 'right' }
    );

    const tableBody = activePatients.map((patient) => {
      const activeMeds = patient.medications.filter((m) => m.active);
      const pendingItems = patient.pendings.filter((p) => !p.completed);
      const critItems = formatCriticalCareSystemsSummary(patient.criticalCareSystems);
      const nonRedundantTags = getNonRedundantClinicalTags(patient.clinicalTags);

      // Col 1: IDENTIFICACION • MEDICO • ESTADO / RCP / SOPORTE
      // Note: Top 2 lines are reserved for the custom vector badges (Bed, StayDays, Severity, RCP, Intubado/CPAP, and Colored Doctor Badge)
      const col1Lines = [
        ' ', // Reserved space for Row 1 Badges (Cama, DE, Gravedad, RCP, Intubado/CPAP)
        ' ', // Reserved space for Row 2 Badge (Médico a Cargo con color)
        `${patient.name} (${patient.age}a - ${patient.gender.slice(0, 1).toUpperCase()} - Exp:${patient.recordNumber})`,
      ];
      if (nonRedundantTags.length > 0) {
        col1Lines.push(`Tags: ${nonRedundantTags.join(' | ')}`);
      }

      // Col 2: MOTIVO INGRESO • DX ACTUALES (CIE-10) • ANTECEDENTES/ALERGIAS
      const col2Lines: string[] = [];
      if (patient.admissionReason) {
        col2Lines.push(`Motivo: ${patient.admissionReason}`);
      }
      if (patient.diagnoses.length > 0) {
        patient.diagnoses.forEach((d, i) => {
          col2Lines.push(`${i + 1}. ${d.replace(/^\d+[\.\)]\s*/, '')}`);
        });
      }
      if (patient.allergies && patient.allergies !== 'Negadas') {
        col2Lines.push(`ALERG: ${patient.allergies}`);
      }
      if (patient.relevantHistory) {
        col2Lines.push(`APP: ${patient.relevantHistory}`);
      }

      // Col 3: APUNTE PASE • SV • SISTEMAS CRITICOS (Never dumps long evolutionSummary!)
      const col3Lines: string[] = [];
      if (patient.vitals) {
        col3Lines.push(
          `SV: TA ${patient.vitals.bp} | FC ${patient.vitals.hr} | FR ${patient.vitals.rr} | T ${patient.vitals.temp}C | SpO2 ${patient.vitals.spo2}%${
            patient.vitals.glucose ? ` | Gluc ${patient.vitals.glucose}` : ''
          }`
        );
      }
      if (patient.roundsPresentationNote && patient.roundsPresentationNote.trim()) {
        col3Lines.push(`Pase Hoy: ${patient.roundsPresentationNote.trim()}`);
      }
      if (critItems.length > 0) {
        critItems.forEach((ci) => {
          col3Lines.push(`[${ci.shortLabel}] ${ci.summary}`);
        });
      }

      // Col 4: PARACLINICOS (LABS HOY vs PREV • GABINETE)
      const col4Text = formatCompactParaclinicsText(patient);

      // Col 5: TERAPEUTICA (DIETA • SOLUCIONES • ATB/MEDS)
      const indLines: string[] = [];
      if (patient.diet) indLines.push(`Dieta: ${patient.diet}`);
      if (patient.structuredSolutions && patient.structuredSolutions.length > 0) {
        indLines.push(
          `Sol: ${patient.structuredSolutions.map((s) => formatParenteralSolutionLine(s)).join(' + ')}`
        );
      } else if (patient.ivFluids) {
        indLines.push(`Sol: ${patient.ivFluids}`);
      }
      activeMeds.forEach((m) => {
        const isLimited =
          !m.isAntibiotic && Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0));
        if (m.isAntibiotic) {
          const abStatus = calculateAntibioticDay(m.startDate, m.plannedDays);
          indLines.push(
            `* [ATB ${abStatus.displayString}] ${m.name} ${m.dose} ${m.route} ${m.frequency}`
          );
        } else if (isLimited) {
          const limStatus = calculateAntibioticDay(m.startDate, m.plannedDays);
          indLines.push(
            `+ [CICLO ${limStatus.displayString}] ${m.name} ${m.dose} ${m.route} ${m.frequency}`
          );
        } else {
          indLines.push(`- ${m.name} ${m.dose} ${m.route} ${m.frequency}`);
        }
      });
      const col5Text = indLines.length > 0 ? indLines.join('\n') : '-';

      // Col 6: PLAN DE MANEJO • PENDIENTES / INTERCONSULTAS
      const col6Lines: string[] = [];
      if (pendingItems.length > 0) {
        pendingItems.forEach((pen) => {
          const prefix =
            pen.isDischargePending || pen.category === 'Alta Hospitalaria' ? '[ ] [ALTA]' : '[ ]';
          col6Lines.push(`${prefix} ${pen.text}`);
        });
      }
      col6Lines.push(' ');
      const col6Text = col6Lines.join('\n');

      return [
        sanitizePdfText(col1Lines.join('\n')),
        sanitizePdfText(col2Lines.length > 0 ? col2Lines.join('\n') : '-'),
        sanitizePdfText(col3Lines.length > 0 ? col3Lines.join('\n') : '-'),
        col4Text,
        sanitizePdfText(col5Text),
        sanitizePdfText(col6Text),
      ];
    });

    // Store wrapped lines per cell so we can custom-render colored badges & line highlights
    const savedCellLines = new Map<string, string[]>();

    const headerColors: Record<number, [number, number, number]> = {
      0: [15, 23, 42], // Slate 900
      1: [19, 78, 74], // Teal 900
      2: [49, 46, 129], // Indigo 900
      3: [22, 78, 99], // Cyan 900
      4: [88, 28, 135], // Purple 900
      5: [6, 78, 59], // Emerald 900
    };

    autoTable(doc, {
      startY: activeMarginMm + 5.5,
      tableWidth: printableWidthMm,
      margin: {
        top: activeMarginMm + 5.5,
        right: activeMarginMm,
        bottom: activeMarginMm,
        left: activeMarginMm,
      },
      head: [
        [
          sanitizePdfText('1. IDENTIFICACION • MEDICO • ESTADO'),
          sanitizePdfText('2. MOTIVO • DX ACTUALES • APP/ALERG'),
          sanitizePdfText('3. APUNTE PASE • SV • SISTEMAS'),
          sanitizePdfText('4. PARACLINICOS (HOY vs PREV • GAB)'),
          sanitizePdfText('5. TERAPEUTICA (DIETA • SOL • MEDS)'),
          sanitizePdfText('6. PLAN • PENDIENTES / ANOTACIONES'),
        ],
      ],
      body:
        tableBody.length > 0
          ? tableBody
          : [['Sin pacientes activos con los filtros seleccionados', '-', '-', '-', '-', ' ']],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.5,
        cellPadding: 1.2,
        textColor: [15, 23, 42],
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.7,
        cellPadding: 1.2,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: printableWidthMm * 0.165, fontStyle: 'bold' },
        1: { cellWidth: printableWidthMm * 0.19 },
        2: { cellWidth: printableWidthMm * 0.175 },
        3: { cellWidth: printableWidthMm * 0.16 },
        4: { cellWidth: printableWidthMm * 0.17 },
        5: { cellWidth: printableWidthMm * 0.14 },
      },
      rowPageBreak: 'avoid',
      didParseCell: (data) => {
        if (data.section === 'head') {
          const colRgb = headerColors[data.column.index];
          if (colRgb) {
            data.cell.styles.fillColor = colRgb;
          }
        }
      },
      willDrawCell: (data) => {
        if (data.section === 'body' && activePatients.length > 0) {
          const key = `${data.row.index}-${data.column.index}`;
          savedCellLines.set(key, [...data.cell.text]);
          // Suppress default plain black text rendering; we draw rich colored lines & badges in didDrawCell
          data.cell.text = [];
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || activePatients.length === 0) return;
        const key = `${data.row.index}-${data.column.index}`;
        const lines = savedCellLines.get(key) || [];
        const patient = activePatients[data.row.index];
        if (!patient) return;

        const pad = 1.2;
        const cellX = data.cell.x + pad;
        const cellY = data.cell.y + pad;
        const availW = data.cell.width - pad * 2;
        const lineH = 2.68;

        // COLUMN 0: Special Vector Badges for Bed, Stay, Severity, RCP, Intubated/CPAP, and Doctor Color
        if (data.column.index === 0) {
          const stayDays = calculateHospitalStayDays(patient.admissionDate);
          const codeInfo = getCodeStatusInfo(patient.codeStatus);
          const respFlags = getRespiratorySupportFlags(patient);
          const docColor = getDoctorColorInfo(patient.attendingPhysician, doctorsCatalogItems);

          let curX = cellX;
          const row1Y = cellY;

          // 1. Bed Badge (Dark Navy)
          curX +=
            drawPdfBadge(doc, patient.bed, curX, row1Y, [15, 23, 42], [255, 255, 255], undefined, 6.2) +
            0.7;

          // 2. Stay Days Badge
          curX +=
            drawPdfBadge(
              doc,
              `DE:${stayDays}d`,
              curX,
              row1Y,
              [226, 232, 240],
              [15, 23, 42],
              [148, 163, 184],
              5.6
            ) + 0.7;

          // 3. Severity Badge
          const sevLabel = patient.severity === 'Muy Grave / UCI' ? 'UCI' : patient.severity.toUpperCase();
          const sevColors: {
            fill: [number, number, number];
            text: [number, number, number];
            border: [number, number, number];
          } =
            patient.severity === 'Grave' || patient.severity === 'Muy Grave / UCI'
              ? { fill: [254, 205, 211], text: [136, 19, 55], border: [225, 29, 72] }
              : patient.severity === 'Delicado'
              ? { fill: [254, 243, 199], text: [120, 53, 15], border: [217, 119, 6] }
              : { fill: [209, 250, 229], text: [6, 95, 70], border: [16, 185, 129] };

          curX +=
            drawPdfBadge(
              doc,
              sevLabel,
              curX,
              row1Y,
              sevColors.fill,
              sevColors.text,
              sevColors.border,
              5.6
            ) + 0.7;

          // 4. RCP 1 / 2 / 3 Badge
          const rcpColors: {
            fill: [number, number, number];
            text: [number, number, number];
            border?: [number, number, number];
          } =
            codeInfo.codeLabel === 'RCP 3'
              ? { fill: [225, 29, 72], text: [255, 255, 255] }
              : codeInfo.codeLabel === 'RCP 2'
              ? { fill: [253, 230, 138], text: [120, 53, 15], border: [217, 119, 6] }
              : { fill: [167, 243, 208], text: [6, 95, 70], border: [16, 185, 129] };

          curX +=
            drawPdfBadge(
              doc,
              codeInfo.codeLabel,
              curX,
              row1Y,
              rcpColors.fill,
              rcpColors.text,
              rcpColors.border,
              5.6
            ) + 0.7;

          // 5. Intubated / CPAP Badges
          if (respFlags.isIntubated && curX + 11 <= cellX + availW) {
            curX +=
              drawPdfBadge(doc, 'INTUBADO', curX, row1Y, [190, 18, 60], [255, 255, 255], undefined, 5.5) +
              0.7;
          }
          if (respFlags.isCpap && curX + 8 <= cellX + availW) {
            drawPdfBadge(doc, 'CPAP', curX, row1Y, [2, 132, 199], [255, 255, 255], undefined, 5.5);
          }

          // Row 2: Doctor Colored Badge ("Tablita de color del médico")
          const row2Y = cellY + 3.5;
          const docRgb = patient.attendingPhysician
            ? hexToRgb(docColor.color)
            : ([100, 116, 139] as [number, number, number]);
          const docFill = tintRgb(docRgb, 0.86);
          const docLabel = sanitizePdfText(patient.attendingPhysician || 'Sin medico asignado');

          doc.setFillColor(docFill[0], docFill[1], docFill[2]);
          doc.setDrawColor(docRgb[0], docRgb[1], docRgb[2]);
          doc.setLineWidth(0.18);
          doc.roundedRect(cellX, row2Y, availW, 3.1, 0.6, 0.6, 'FD');

          // Colored circle indicator inside doctor badge
          doc.setFillColor(docRgb[0], docRgb[1], docRgb[2]);
          doc.circle(cellX + 1.5, row2Y + 1.55, 0.65, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.8);
          doc.setTextColor(docRgb[0], docRgb[1], docRgb[2]);
          doc.text(docLabel, cellX + 2.7, row2Y + 2.2, { maxWidth: availW - 3.2 });

          // Remaining lines (Patient Name, Demographics, Non-Redundant Tags)
          let textY = cellY + 7.2;
          const bodyLines = lines.slice(2);
          bodyLines.forEach((ln) => {
            const cleanLn = ln.trim();
            if (!cleanLn) return;
            if (cleanLn.startsWith('Tags:')) {
              doc.setFillColor(241, 245, 249);
              doc.roundedRect(cellX, textY - 0.2, availW, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(5.8);
              doc.setTextColor(51, 65, 85);
              doc.text(cleanLn, cellX + 0.8, textY + 1.8);
            } else {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.4);
              doc.setTextColor(15, 23, 42);
              doc.text(cleanLn, cellX, textY + 1.8);
            }
            textY += lineH;
          });
          return;
        }

        // COLUMNS 1 TO 5: Line-by-line Color-Coded Strips & Highlights
        let curY = cellY;
        let currentBlockStyle:
          | 'normal'
          | 'motivo'
          | 'alerg'
          | 'sv'
          | 'pase'
          | 'crit'
          | 'hoy'
          | 'prev'
          | 'study'
          | 'dieta'
          | 'atb'
          | 'ciclo'
          | 'alta'
          | 'pending' = 'normal';

        lines.forEach((rawLine) => {
          const line = rawLine.trimEnd();
          const trimmed = line.trim();

          // Detect block type at start of a logical item, or inherit for wrapped continuation lines
          if (trimmed.startsWith('Motivo:')) {
            currentBlockStyle = 'motivo';
          } else if (trimmed.startsWith('ALERG:')) {
            currentBlockStyle = 'alerg';
          } else if (trimmed.startsWith('APP:')) {
            currentBlockStyle = 'normal';
          } else if (/^\d+\.\s/.test(trimmed)) {
            currentBlockStyle = 'normal';
          } else if (trimmed.startsWith('SV:')) {
            currentBlockStyle = 'sv';
          } else if (trimmed.startsWith('Pase Hoy:')) {
            currentBlockStyle = 'pase';
          } else if (/^\[(Neuro|Resp\/Vent|Hemodinamico|GI \/ Metab|Renal|Infeccioso)\]/i.test(trimmed)) {
            currentBlockStyle = 'crit';
          } else if (trimmed.startsWith('HOY(')) {
            currentBlockStyle = 'hoy';
          } else if (trimmed.startsWith('PREV(')) {
            currentBlockStyle = 'prev';
          } else if (data.column.index === 3 && trimmed.startsWith('[')) {
            currentBlockStyle = 'study';
          } else if (trimmed.startsWith('Dieta:') || trimmed.startsWith('Sol:')) {
            currentBlockStyle = 'dieta';
          } else if (trimmed.startsWith('* [ATB')) {
            currentBlockStyle = 'atb';
          } else if (trimmed.startsWith('+ [CICLO')) {
            currentBlockStyle = 'ciclo';
          } else if (trimmed.startsWith('- ')) {
            currentBlockStyle = 'normal';
          } else if (trimmed.startsWith('[ ] [ALTA]')) {
            currentBlockStyle = 'alta';
          } else if (trimmed.startsWith('[ ]')) {
            currentBlockStyle = 'pending';
          }

          if (trimmed.length > 0) {
            if (currentBlockStyle === 'motivo') {
              doc.setFillColor(240, 253, 250);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.setTextColor(15, 118, 110);
              doc.text(trimmed, cellX + 0.4, curY + 1.9);
            } else if (currentBlockStyle === 'alerg') {
              doc.setFillColor(255, 228, 230);
              doc.setDrawColor(251, 113, 133);
              doc.setLineWidth(0.12);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'FD');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.setTextColor(159, 18, 57);
              doc.text(trimmed, cellX + 0.5, curY + 1.9);
            } else if (currentBlockStyle === 'sv') {
              doc.setFillColor(224, 242, 254);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.1);
              doc.setTextColor(12, 74, 110);
              doc.text(trimmed, cellX + 0.4, curY + 1.9);
            } else if (currentBlockStyle === 'pase') {
              doc.setFillColor(254, 243, 199);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.setTextColor(146, 64, 14);
              doc.text(trimmed, cellX + 0.4, curY + 1.9);
            } else if (currentBlockStyle === 'crit') {
              doc.setFillColor(255, 241, 242);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.0);
              doc.setTextColor(159, 18, 57);
              doc.text(trimmed, cellX + 0.4, curY + 1.9);
            } else if (currentBlockStyle === 'hoy') {
              doc.setFillColor(240, 249, 255);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.1);
              doc.setTextColor(3, 105, 161);
              doc.text(trimmed, cellX + 0.4, curY + 1.9);
            } else if (currentBlockStyle === 'prev') {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(5.9);
              doc.setTextColor(100, 116, 139);
              doc.text(trimmed, cellX + 0.2, curY + 1.9);
            } else if (currentBlockStyle === 'study') {
              doc.setFillColor(236, 254, 255);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.0);
              doc.setTextColor(21, 94, 117);
              doc.text(trimmed, cellX + 0.4, curY + 1.9);
            } else if (currentBlockStyle === 'dieta') {
              doc.setFillColor(241, 245, 249);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.1);
              doc.setTextColor(30, 41, 59);
              doc.text(trimmed, cellX + 0.4, curY + 1.9);
            } else if (currentBlockStyle === 'atb') {
              // Purple badge highlight for Antibiotics
              doc.setFillColor(243, 232, 255);
              doc.setDrawColor(192, 132, 252);
              doc.setLineWidth(0.12);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'FD');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.setTextColor(107, 33, 168);
              doc.text(trimmed.replace(/^\*\s*/, ''), cellX + 0.5, curY + 1.9);
            } else if (currentBlockStyle === 'ciclo') {
              // Amber badge highlight for Limited-Time / Short-Course Medications (Steroids, etc.)
              doc.setFillColor(254, 243, 199);
              doc.setDrawColor(251, 191, 36);
              doc.setLineWidth(0.12);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'FD');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.setTextColor(146, 64, 14);
              doc.text(trimmed.replace(/^\+\s*/, ''), cellX + 0.5, curY + 1.9);
            } else if (currentBlockStyle === 'alta') {
              doc.setFillColor(255, 228, 230);
              doc.setDrawColor(244, 63, 94);
              doc.setLineWidth(0.12);
              doc.roundedRect(cellX - 0.3, curY - 0.1, availW + 0.6, lineH, 0.4, 0.4, 'FD');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.setTextColor(190, 18, 60);
              doc.text(trimmed, cellX + 0.5, curY + 1.9);
            } else if (currentBlockStyle === 'pending') {
              if (trimmed.startsWith('[ ]')) {
                // Draw a crisp teal/slate vector checkbox square
                doc.setDrawColor(13, 148, 136);
                doc.setFillColor(240, 253, 250);
                doc.setLineWidth(0.2);
                doc.rect(cellX, curY + 0.35, 1.8, 1.8, 'FD');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.2);
                doc.setTextColor(15, 23, 42);
                doc.text(trimmed.replace(/^\[\s*\]\s*/, ''), cellX + 2.4, curY + 1.9);
              } else {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.2);
                doc.setTextColor(15, 23, 42);
                doc.text(trimmed, cellX + 2.4, curY + 1.9);
              }
            } else {
              doc.setFont('helvetica', /^\d+\.\s/.test(trimmed) ? 'bold' : 'normal');
              doc.setFontSize(6.3);
              doc.setTextColor(15, 23, 42);
              doc.text(trimmed, cellX, curY + 1.9);
            }
          }

          curY += lineH;
        });
      },
    });

    return doc;
  };

  const handleDownloadPdf = () => {
    try {
      const doc = buildPdfDocument();
      const today = new Date().toISOString().split('T')[0];
      const cleanService = (profile.service || 'Hospital').replace(/\s+/g, '_');
      const filename = `Censo-Color-${cleanService}-${today}.pdf`;

      doc.save(filename);

      const blob = doc.output('blob');
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);

      if (onShowToast) {
        onShowToast(`PDF a color descargado: ${filename}`);
      }
    } catch (err) {
      console.error('Error al generar PDF:', err);
      if (onShowToast) {
        onShowToast('Error al generar el archivo PDF.');
      }
    }
  };

  // Direct synchronous browser print preserving transient user activation gesture
  const handleDirectBrowserPrint = () => {
    try {
      // 1. Call window.print() synchronously on the user click gesture so browsers/iframes open the print dialog immediately
      window.print();
    } catch (err) {
      console.error('Error al invocar window.print():', err);
    }

    // 2. Also prepare the color PDF & open the Print Portal as a backup in case the host iframe blocks native window.print()
    try {
      const doc = buildPdfDocument();
      const blob = doc.output('blob');
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenPrintPortal = () => {
    try {
      const doc = buildPdfDocument();
      const blob = doc.output('blob');
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (e) {
      console.error(e);
    }
    setIsPrintPortalOpen(true);
  };

  const getTagBadgeStyle = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('alto flujo')) {
      return 'bg-indigo-50 text-indigo-900 border-indigo-400 font-bold';
    }
    if (t.includes('aislado')) {
      return 'bg-amber-50 text-amber-900 border-amber-400 font-bold';
    }
    if (t.includes('hemodiálisis') || t.includes('hemodialisis')) {
      return 'bg-cyan-50 text-cyan-900 border-cyan-400 font-bold';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300 font-semibold';
  };

  // Render table in exact 6-column Rounds Presentation order (1 → 2 → 3 → 4 → 5 → 6)
  const renderSquashedPrintableTable = () => (
    <table className="w-full table-fixed text-left border-collapse border border-black text-[7.2pt] leading-[1.07]">
      <thead>
        <tr className="bg-slate-900 text-white font-bold border-b border-black text-[6.7pt] leading-tight">
          <th className="px-1 py-0.5 border border-black w-[16.5%] text-left break-words bg-slate-900">
            1. IDENTIFICACIÓN • MÉDICO • ESTADO
          </th>
          <th className="px-1 py-0.5 border border-black w-[19%] text-left break-words bg-teal-900">
            2. MOTIVO • DX ACTUALES • APP/ALERG
          </th>
          <th className="px-1 py-0.5 border border-black w-[17.5%] text-left break-words bg-indigo-950">
            3. APUNTE PASE • SV • SISTEMAS
          </th>
          <th className="px-1 py-0.5 border border-black w-[16%] text-left break-words bg-cyan-950">
            4. PARACLÍNICOS (HOY vs PREV • GAB)
          </th>
          <th className="px-1 py-0.5 border border-black w-[17%] text-left break-words bg-purple-950">
            5. TERAPÉUTICA (DIETA • SOL • MEDS)
          </th>
          <th className="px-1 py-0.5 border border-black w-[14%] text-left break-words bg-emerald-950">
            6. PLAN • PENDIENTES / ANOTACIONES
          </th>
        </tr>
      </thead>
      <tbody>
        {activePatients.length === 0 ? (
          <tr>
            <td colSpan={6} className="p-1.5 text-center text-slate-500 italic border border-black">
              No hay pacientes activos para mostrar con los filtros seleccionados.
            </td>
          </tr>
        ) : (
          activePatients.map((patient, index) => {
            const stayDays = calculateHospitalStayDays(patient.admissionDate);
            const activeMeds = patient.medications.filter((m) => m.active);
            const latestLab = patient.labs && patient.labs.length > 0 ? patient.labs[0] : null;
            const prevLab = patient.labs && patient.labs.length > 1 ? patient.labs[1] : null;
            const pendingItems = patient.pendings.filter((p) => !p.completed);
            const studiesList = patient.studies || [];
            const codeInfo = getCodeStatusInfo(patient.codeStatus);
            const respFlags = getRespiratorySupportFlags(patient);
            const nonRedundantTags = getNonRedundantClinicalTags(patient.clinicalTags);
            const docColor = getDoctorColorInfo(
              patient.attendingPhysician,
              doctorsCatalogItems
            );
            const critItems = formatCriticalCareSystemsSummary(patient.criticalCareSystems);
            const extraLabEntries = latestLab?.extraParams
              ? Object.values(latestLab.extraParams)
              : [];

            return (
              <tr
                key={patient.id}
                className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} border-b border-black`}
              >
                {/* COL 1: IDENTIFICACIÓN • MÉDICO • ESTADO / RCP / SOPORTE */}
                <td className="px-1 py-[1.5px] border border-black align-top break-words overflow-hidden">
                  <div className="flex flex-wrap items-baseline gap-x-1 leading-[1.06]">
                    <span className="bg-slate-900 text-white font-black px-1 py-0 rounded text-[7.6pt] font-mono shrink-0">
                      {patient.bed}
                    </span>
                    <span className="font-bold text-slate-950 text-[7.6pt] break-words">
                      {patient.name}
                    </span>
                    <span className="text-[6.6pt] text-slate-700 font-mono">
                      ({patient.age}a•{patient.gender.slice(0, 1).toUpperCase()}•#{patient.recordNumber})
                    </span>
                    <span className="font-bold text-[6.5pt] text-slate-900 bg-slate-200 px-1 rounded font-mono ml-auto">
                      DE:{stayDays}d
                    </span>
                  </div>

                  {/* Médico a Cargo con su color personalizado */}
                  <div
                    className="text-[6.6pt] font-bold rounded px-1 py-0 my-[1px] leading-tight break-words border inline-flex items-center gap-1 max-w-full"
                    style={
                      patient.attendingPhysician
                        ? docColor.badgeStyle
                        : { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', color: '#334155' }
                    }
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: patient.attendingPhysician ? docColor.color : '#64748b',
                      }}
                    />
                    <span>{patient.attendingPhysician || 'Sin médico asignado'}</span>
                  </div>

                  {/* Estado, RCP 1/2/3, Intubado/CPAP y Etiquetas No Redundantes */}
                  <div className="flex flex-wrap items-center gap-0.5 mt-[1px] leading-none">
                    <span
                      className={`text-[6.2pt] px-1 py-0 rounded font-extrabold uppercase border ${
                        patient.severity === 'Grave' || patient.severity === 'Muy Grave / UCI'
                          ? 'bg-rose-100 text-rose-950 border-rose-400'
                          : patient.severity === 'Delicado'
                          ? 'bg-amber-100 text-amber-950 border-amber-400'
                          : 'bg-emerald-50 text-emerald-950 border-emerald-300'
                      }`}
                    >
                      {patient.severity === 'Muy Grave / UCI' ? 'UCI' : patient.severity}
                    </span>

                    <span
                      className={`text-[6.2pt] px-1 py-0 rounded border font-black uppercase ${
                        codeInfo.codeLabel === 'RCP 3'
                          ? 'bg-rose-600 text-white border-rose-800'
                          : codeInfo.codeLabel === 'RCP 2'
                          ? 'bg-amber-200 text-amber-950 border-amber-500'
                          : 'bg-emerald-100 text-emerald-950 border-emerald-400'
                      }`}
                    >
                      {codeInfo.codeLabel}
                    </span>

                    {respFlags.isIntubated && (
                      <span className="text-[6.2pt] px-1 py-0 rounded bg-rose-700 text-white border border-rose-900 font-black">
                        INTUBADO
                      </span>
                    )}

                    {respFlags.isCpap && (
                      <span className="text-[6.2pt] px-1 py-0 rounded bg-sky-600 text-white border border-sky-800 font-black">
                        CPAP
                      </span>
                    )}

                    {nonRedundantTags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className={`text-[6pt] px-1 py-0 rounded border ${getTagBadgeStyle(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>

                {/* COL 2: MOTIVO DE INGRESO • DX ACTUALES (CON CIE-10) • ANTECEDENTES/ALERGIAS */}
                <td className="px-1 py-[1.5px] border border-black align-top leading-[1.06] break-words overflow-hidden">
                  {patient.admissionReason && (
                    <div className="text-[6.6pt] bg-teal-50 text-teal-950 border-b border-teal-200 px-0.5 mb-[1px] break-words">
                      <strong>Motivo:</strong> {patient.admissionReason}
                    </div>
                  )}

                  {patient.diagnoses.length > 0 ? (
                    <div>
                      {patient.diagnoses.map((diag, dIdx) => {
                        const cleanDiag = diag.replace(/^\d+[\.\)]\s*/, '');
                        return (
                          <div key={dIdx} className="break-words">
                            <strong className="text-slate-900">{dIdx + 1}.</strong> {cleanDiag}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}

                  {(patient.relevantHistory ||
                    (patient.allergies && patient.allergies !== 'Negadas')) && (
                    <div className="mt-[1px] pt-[1px] border-t border-slate-200 text-[6.4pt] space-y-[0.5px]">
                      {patient.allergies && patient.allergies !== 'Negadas' && (
                        <div className="text-rose-900 font-extrabold bg-rose-50 px-0.5 rounded border border-rose-300 inline-block mr-1">
                          ALERG: {patient.allergies}
                        </div>
                      )}
                      {patient.relevantHistory && (
                        <div className="text-slate-700 break-words">
                          <strong>APP:</strong> {patient.relevantHistory}
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {/* COL 3: APUNTE RÁPIDO PARA EL PASE • SIGNOS VITALES • SISTEMAS CRÍTICOS */}
                <td className="px-1 py-[1.5px] border border-black align-top leading-[1.06] break-words overflow-hidden">
                  {patient.vitals && (
                    <div className="text-[6.6pt] font-mono bg-sky-50 border-b border-sky-200 px-0.5 mb-[1px] text-sky-950 leading-[1.05] break-words">
                      <strong>SV:</strong> TA {patient.vitals.bp} • FC {patient.vitals.hr} • FR{' '}
                      {patient.vitals.rr} • T {patient.vitals.temp}° • SpO2 {patient.vitals.spo2}%
                      {patient.vitals.glucose ? ` • Gluc ${patient.vitals.glucose}` : ''}
                    </div>
                  )}

                  {patient.roundsPresentationNote && patient.roundsPresentationNote.trim() && (
                    <div className="text-[6.7pt] bg-amber-50 border border-amber-200 rounded px-0.5 text-amber-950 mb-[1px] break-words">
                      <strong className="text-amber-900">Pase Hoy:</strong>{' '}
                      {patient.roundsPresentationNote}
                    </div>
                  )}

                  {critItems.length > 0 && (
                    <div className="space-y-[0.5px] border-t border-slate-200 pt-[1px] text-[6.3pt]">
                      {critItems.map((ci) => (
                        <div key={ci.key} className="break-words">
                          <strong className="uppercase text-rose-900 bg-rose-50 px-0.5 rounded">
                            [{ci.shortLabel}]:
                          </strong>{' '}
                          {ci.summary}
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* COL 4: PARACLÍNICOS (LABS HOY vs PREV • GABINETE) */}
                <td className="px-1 py-[1.5px] border border-black align-top font-mono text-[6.6pt] leading-[1.06] tabular-nums break-words overflow-hidden">
                  {latestLab ? (
                    <div className="break-words">
                      <div className="text-slate-950 break-words">
                        <strong className="font-sans bg-sky-100 text-sky-950 px-0.5 rounded mr-0.5">
                          HOY({latestLab.date.slice(5)}):
                        </strong>{' '}
                        {latestLab.hb !== undefined && (
                          <span>
                            Hb:<strong>{latestLab.hb}</strong>{' '}
                          </span>
                        )}
                        {latestLab.leucos !== undefined && (
                          <span>
                            L:<strong>{(latestLab.leucos / 1000).toFixed(1)}k</strong>{' '}
                          </span>
                        )}
                        {latestLab.plaquetas !== undefined && (
                          <span>
                            Plq:<strong>{(latestLab.plaquetas / 1000).toFixed(0)}k</strong>{' '}
                          </span>
                        )}
                        {latestLab.glucosa !== undefined && (
                          <span>
                            Gluc:<strong>{latestLab.glucosa}</strong>{' '}
                          </span>
                        )}
                        {latestLab.creatinina !== undefined && (
                          <span>
                            Cr:<strong>{latestLab.creatinina}</strong>{' '}
                          </span>
                        )}
                        {latestLab.bun !== undefined && (
                          <span>
                            BUN:<strong>{latestLab.bun}</strong>{' '}
                          </span>
                        )}
                        {latestLab.na !== undefined && (
                          <span>
                            Na:<strong>{latestLab.na}</strong>{' '}
                          </span>
                        )}
                        {latestLab.k !== undefined && (
                          <span>
                            K:<strong>{latestLab.k}</strong>{' '}
                          </span>
                        )}
                        {latestLab.cl !== undefined && (
                          <span>
                            Cl:<strong>{latestLab.cl}</strong>{' '}
                          </span>
                        )}
                        {latestLab.ph !== undefined && (
                          <span>
                            pH:<strong>{latestLab.ph}</strong>{' '}
                          </span>
                        )}
                        {latestLab.lactato !== undefined && (
                          <span>
                            Lac:<strong>{latestLab.lactato}</strong>{' '}
                          </span>
                        )}
                        {extraLabEntries.slice(0, 5).map((ep, idx) => (
                          <span key={idx}>
                            {ep.label}:<strong>{ep.value}</strong>{' '}
                          </span>
                        ))}
                      </div>

                      {prevLab && (
                        <div className="text-slate-600 text-[6.2pt] border-t border-slate-200 break-words">
                          <strong className="font-sans">PREV({prevLab.date.slice(5)}):</strong> Hb:{' '}
                          {prevLab.hb ?? '-'} | L:{' '}
                          {prevLab.leucos ? (prevLab.leucos / 1000).toFixed(1) + 'k' : '-'} | Cr:{' '}
                          {prevLab.creatinina ?? '-'} | Na/K: {prevLab.na ?? '-'}/{prevLab.k ?? '-'}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {studiesList.length > 0 && (
                    <div className="font-sans text-[6.4pt] border-t border-slate-200 mt-[1px] pt-[1px] break-words">
                      {studiesList.slice(0, 2).map((st) => (
                        <div
                          key={st.id}
                          className={`break-words ${
                            st.isNew ? 'text-cyan-950 font-semibold bg-cyan-50/70 px-0.5 rounded' : 'text-slate-900'
                          }`}
                        >
                          <span className="font-extrabold text-[6pt]">
                            [{st.category} {st.date.slice(5)}]
                          </span>{' '}
                          <strong>{st.title}:</strong> {st.summary}
                        </div>
                      ))}
                    </div>
                  )}

                  {!latestLab && studiesList.length === 0 && (
                    <span className="text-slate-400 font-sans">-</span>
                  )}
                </td>

                {/* COL 5: TERAPÉUTICA (DIETA • SOLUCIONES • ATB / MEDICAMENTOS) */}
                <td className="px-1 py-[1.5px] border border-black align-top leading-[1.06] break-words overflow-hidden">
                  {(patient.diet ||
                    patient.ivFluids ||
                    (patient.structuredSolutions && patient.structuredSolutions.length > 0)) && (
                    <div className="text-[6.6pt] bg-slate-100 border-b border-slate-300 px-0.5 py-0 break-words">
                      {patient.diet && (
                        <div>
                          <strong>Dieta:</strong> {patient.diet}
                        </div>
                      )}
                      {patient.structuredSolutions && patient.structuredSolutions.length > 0 ? (
                        <div>
                          <strong>Sol:</strong>{' '}
                          {patient.structuredSolutions
                            .map((s) => formatParenteralSolutionLine(s))
                            .join(' + ')}
                        </div>
                      ) : (
                        patient.ivFluids && (
                          <div>
                            <strong>Sol:</strong> {patient.ivFluids}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {activeMeds.length > 0 ? (
                    <div>
                      {activeMeds.map((m) => {
                        const isLimited =
                          !m.isAntibiotic &&
                          Boolean(m.isLimitedCourse || (m.plannedDays && m.plannedDays > 0));
                        if (m.isAntibiotic) {
                          const abStatus = calculateAntibioticDay(m.startDate, m.plannedDays);
                          return (
                            <div
                              key={m.id}
                              className="bg-purple-50 border-b border-purple-200 text-purple-950 px-0.5 flex flex-wrap items-baseline justify-between gap-1 break-words"
                            >
                              <span className="break-words">
                                <strong className="font-extrabold">• {m.name}</strong> {m.dose}{' '}
                                {m.route} {m.frequency}
                              </span>
                              <span className="bg-purple-200 text-purple-950 px-1 rounded font-black text-[6.2pt] font-mono shrink-0">
                                {abStatus.displayString}
                              </span>
                            </div>
                          );
                        }
                        if (isLimited) {
                          const limStatus = calculateAntibioticDay(m.startDate, m.plannedDays);
                          return (
                            <div
                              key={m.id}
                              className="bg-amber-50 border-b border-amber-200 text-amber-950 px-0.5 flex flex-wrap items-baseline justify-between gap-1 break-words"
                            >
                              <span className="break-words">
                                <strong className="font-extrabold">• {m.name}</strong> {m.dose}{' '}
                                {m.route} {m.frequency}
                              </span>
                              <span className="bg-amber-200 text-amber-950 px-1 rounded font-black text-[6.2pt] font-mono shrink-0">
                                {limStatus.displayString}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div key={m.id} className="text-slate-950 break-words">
                            <strong>• {m.name}</strong> {m.dose} {m.route} {m.frequency}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !patient.diet &&
                    !patient.ivFluids && <span className="text-slate-400">-</span>
                  )}
                </td>

                {/* COL 6: PLAN DE MANEJO • PENDIENTES / INTERCONSULTAS / ANOTACIONES */}
                <td className="px-1 py-[1.5px] border border-black align-top leading-[1.06] break-words overflow-hidden min-h-[36px]">
                  {pendingItems.length > 0 && (
                    <div className="space-y-[1px] break-words">
                      {pendingItems.map((pen) => (
                        <div key={pen.id} className="flex items-baseline gap-1 break-words">
                          <span className="inline-block w-2.5 h-2.5 border border-teal-700 bg-teal-50/60 shrink-0 translate-y-[1px]" />
                          <span
                            className={`break-words ${
                              pen.isDischargePending || pen.category === 'Alta Hospitalaria'
                                ? 'font-black text-rose-950 bg-rose-100 px-0.5 rounded'
                                : pen.priority === 'Alta' || pen.urgencyColor === 'red'
                                ? 'font-black text-rose-950'
                                : 'text-slate-900 font-medium'
                            }`}
                          >
                            {pen.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="h-4 w-full" aria-hidden="true" />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-2.5">
      {/* Control Toolbar (STRICTLY HIDDEN IN PRINT) */}
      <div className="bg-white dark:bg-slate-800 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs print:hidden space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-lg shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <span className="truncate">Censo Imprimible a Color</span>
              <InfoPopover
                title="Censo a Color y Distintivos para Tablet o Impresión"
                content="Tanto la hoja imprimible como el archivo .PDF conservan los distintivos de color (Cama, Médico a Cargo, Gravedad, RCP 1/2/3, Intubado/CPAP, Antibióticos en morado y Ciclos cortos en ámbar). En la columna 3 solo se muestra el Apunte Rápido de Pase (sin volcar el análisis largo de la nota)."
              />
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Toggle filters on mobile/tablet to save vertical space */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="xl:hidden flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              title="Mostrar/ocultar filtros de servicio, médico y márgenes"
            >
              <Filter className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Filtros</span>
              {showMobileFilters ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Descargar archivo .PDF a Color con distintivos de tabla (ideal para Tablet o impresión)"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span>PDF a Color</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintPortal}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Abrir vista previa de hoja Carta y visor PDF"
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Vista Previa</span>
            </button>

            <button
              type="button"
              onClick={handleDirectBrowserPrint}
              aria-label="Imprimir censo en el navegador"
              title="Abrir diálogo de impresión del navegador inmediatamente"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-teal-700 dark:hover:bg-teal-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Filters & Margins Row (Always visible on xl desktop, collapsible on mobile/tablet) */}
        <div
          className={`${
            showMobileFilters ? 'flex' : 'hidden xl:flex'
          } flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs`}
        >
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">Servicio:</span>
          </div>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none max-w-full sm:max-w-[200px] truncate"
          >
            <option value="all">Todos los Servicios ({patients.length})</option>
            {(profile?.servicesCatalog && profile.servicesCatalog.length > 0
              ? profile.servicesCatalog
              : defaultServicesCatalog
            ).map((srv) => (
              <option key={srv.id} value={srv.name}>
                {srv.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">Médico:</span>
          </div>

          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            aria-label="Filtrar censo imprimible por médico a cargo"
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none max-w-full sm:max-w-[200px] truncate"
          >
            <option value="all">Todos los Médicos</option>
            {availableDoctors.map((docName) => (
              <option key={docName} value={docName}>
                {docName}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Margen:
            </span>
            <select
              value={marginPreset}
              onChange={(e) => setMarginPreset(e.target.value as '8' | '10' | '14' | 'custom')}
              aria-label="Seleccionar margen de impresión"
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="8">Estrecho (8 mm)</option>
              <option value="10">Institucional (10 mm)</option>
              <option value="14">Normal (14 mm)</option>
              <option value="custom">Personalizado</option>
            </select>
            {marginPreset === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={4}
                  max={25}
                  value={customMarginMm}
                  onChange={(e) => setCustomMarginMm(parseInt(e.target.value, 10) || 10)}
                  className="w-12 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-center text-[11px]"
                />
                <span className="text-[10px] text-slate-500">mm</span>
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={includeDischarged}
              onChange={(e) => setIncludeDischarged(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Incluir egresos</span>
          </label>

          <div className="ml-auto flex items-center gap-1.5 text-slate-500 text-[11px] font-mono tabular-nums">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span>
              <strong>{activePatients.length}</strong> pac.
            </span>
          </div>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div
        ref={sheetRef}
        className="bg-white text-black rounded-xl border border-slate-300 shadow-sm printable-sheet-root overflow-x-auto"
        style={{ padding: `${activeMarginMm}mm` }}
      >
        <div className="flex flex-wrap items-center justify-between bg-slate-900 text-white px-2.5 py-1.5 rounded-t-md border-b border-black mb-1 text-[8pt] font-sans leading-none gap-2">
          <div className="font-black uppercase tracking-tight flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" />
            <span>
              CENSO CLÍNICO EN ORDEN DE PASE DE VISITA • {profile.hospital || 'HOSPITAL GENERAL'} •{' '}
              {serviceFilter === 'all' ? profile.service || 'TODOS LOS SERVICIOS' : serviceFilter}
              {doctorFilter !== 'all' ? ` • MÉDICO: ${doctorFilter.toUpperCase()}` : ''}
            </span>
          </div>
          <div className="font-mono text-[7.3pt] text-teal-200 font-bold">
            {new Date().toISOString().split('T')[0]} • {activePatients.length} PACIENTES • MARGEN{' '}
            {activeMarginMm}MM
          </div>
        </div>

        {renderSquashedPrintableTable()}
      </div>

      {/* PORTAL DE IMPRESIÓN Y VISOR PDF A COLOR */}
      {isPrintPortalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-white">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
                  <Printer className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold flex flex-wrap items-center gap-2">
                    <span>Portal de Impresión a Color • Carta Horizontal</span>
                    <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPortalViewMode('html')}
                        className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                          portalViewMode === 'html'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Hoja a Color
                      </button>
                      <button
                        type="button"
                        onClick={() => setPortalViewMode('pdf')}
                        className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                          portalViewMode === 'pdf'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Visor PDF Nativo
                      </button>
                    </div>
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Descargar PDF a Color</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir en Navegador</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintPortalOpen(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  aria-label="Cerrar portal de impresión"
                >
                  <X className="w-4 h-4" />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 sm:p-5 bg-slate-800/90 flex flex-col items-center gap-3">
              {portalViewMode === 'pdf' && pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  title="Visor PDF a Color"
                  className="w-full max-w-[1056px] h-[72vh] bg-white rounded-lg border border-slate-600 shadow-2xl"
                />
              ) : (
                <div
                  className="w-full max-w-[1056px] bg-white text-black shadow-2xl rounded-xs relative overflow-x-auto"
                  style={{
                    minHeight: '580px',
                    padding: `${Math.round(activeMarginMm * 3.78)}px`,
                  }}
                >
                  <div className="border border-dashed border-teal-500/60 p-1">
                    <div className="flex items-center justify-between bg-slate-900 text-white px-2.5 py-1.5 rounded-t-md border-b border-black mb-1 text-[8pt] font-sans leading-none">
                      <div className="font-black uppercase tracking-tight">
                        CENSO CLÍNICO EN ORDEN DE PASE DE VISITA •{' '}
                        {profile.hospital || 'HOSPITAL GENERAL'} •{' '}
                        {serviceFilter === 'all'
                          ? profile.service || 'TODOS LOS SERVICIOS'
                          : serviceFilter}
                        {doctorFilter !== 'all' ? ` • MÉDICO: ${doctorFilter.toUpperCase()}` : ''}
                      </div>
                      <div className="font-mono text-[7.3pt] text-teal-200 font-bold">
                        {new Date().toISOString().split('T')[0]} • {activePatients.length} PACIENTES •
                        MARGEN {activeMarginMm}MM
                      </div>
                    </div>

                    {renderSquashedPrintableTable()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
