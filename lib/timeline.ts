import type { Patient, Study, TimelineEvent, PatientTimeStats } from "./types"

/**
 * Genera el timeline de eventos para un paciente
 */
export function generatePatientTimeline(patient: Patient, studies: Study[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  let previousTimestamp = patient.admissionTime

  // 1. Admisión al hospital
  events.push({
    id: `${patient.id}-admission`,
    timestamp: patient.admissionTime,
    type: "admission",
    title: "Ingreso a Emergencias",
    description: `Paciente ingresado con diagnóstico: ${patient.diagnosis}`,
    duration: 0,
  })

  // 2. Asignación al médico
  if (patient.assignedToDoctorAt) {
    const duration = calculateDuration(previousTimestamp, patient.assignedToDoctorAt)
    events.push({
      id: `${patient.id}-doctor-assigned`,
      timestamp: patient.assignedToDoctorAt,
      type: "doctor_assigned",
      title: "Asignado a Médico",
      description: "Paciente asignado a médico tratante",
      duration,
    })
    previousTimestamp = patient.assignedToDoctorAt
  }

  // 3. Primer estudio solicitado
  if (patient.firstStudyRequestedAt) {
    const duration = calculateDuration(previousTimestamp, patient.firstStudyRequestedAt)
    events.push({
      id: `${patient.id}-first-study`,
      timestamp: patient.firstStudyRequestedAt,
      type: "study_requested",
      title: "Estudios Solicitados",
      description: `${studies.length} estudio(s) solicitado(s)`,
      duration,
    })
    previousTimestamp = patient.firstStudyRequestedAt
  }

  // 4. Eventos de cada estudio
  const sortedStudies = [...studies].sort(
    (a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
  )

  sortedStudies.forEach((study) => {
    // Estudio en progreso
    if (study.inProgressAt) {
      const duration = calculateDuration(previousTimestamp, study.inProgressAt)
      events.push({
        id: `${study.id}-in-progress`,
        timestamp: study.inProgressAt,
        type: "study_in_progress",
        title: `${study.name} - En Proceso`,
        description: `Estudio ${study.type} en proceso`,
        duration,
      })
      previousTimestamp = study.inProgressAt
    }

    // Estudio completado
    if (study.completedAt) {
      const duration = calculateDuration(previousTimestamp, study.completedAt)
      events.push({
        id: `${study.id}-completed`,
        timestamp: study.completedAt,
        type: "study_completed",
        title: `${study.name} - Completado`,
        description: study.hasAlert
          ? "⚠️ Resultado anormal detectado"
          : "Resultado disponible",
        duration,
      })
      previousTimestamp = study.completedAt
    }

    // Estudio revisado por médico
    if (study.reviewedAt) {
      const duration = calculateDuration(previousTimestamp, study.reviewedAt)
      events.push({
        id: `${study.id}-reviewed`,
        timestamp: study.reviewedAt,
        type: "study_reviewed",
        title: `${study.name} - Revisado`,
        description: "Resultado revisado por médico",
        duration,
      })
      previousTimestamp = study.reviewedAt
    }
  })

  // 5. Todos los estudios completados
  if (patient.allStudiesCompletedAt) {
    const duration = calculateDuration(previousTimestamp, patient.allStudiesCompletedAt)
    events.push({
      id: `${patient.id}-all-completed`,
      timestamp: patient.allStudiesCompletedAt,
      type: "all_completed",
      title: "Todos los Estudios Completados",
      description: "Paciente listo para evaluación final",
      duration,
    })
    previousTimestamp = patient.allStudiesCompletedAt
  }

  // 6. Alta del paciente
  if (patient.dischargedAt) {
    const duration = calculateDuration(previousTimestamp, patient.dischargedAt)
    events.push({
      id: `${patient.id}-discharge`,
      timestamp: patient.dischargedAt,
      type: "discharge",
      title: "Alta Médica",
      description: "Paciente dado de alta",
      duration,
    })
  }

  // Ordenar eventos cronológicamente por timestamp
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

/**
 * Calcula estadísticas de tiempo para un paciente
 */
export function calculatePatientTimeStats(
  patient: Patient,
  studies: Study[]
): PatientTimeStats {
  const now = new Date()
  const admissionTime = new Date(patient.admissionTime)
  const dischargeTime = patient.dischargedAt ? new Date(patient.dischargedAt) : now

  // Tiempo total en el hospital
  const totalTime = Math.floor((dischargeTime.getTime() - admissionTime.getTime()) / 60000)

  // Tiempo esperando que se completen estudios
  let waitingForStudies = 0
  studies.forEach((study) => {
    const requestedAt = new Date(study.requestedAt)
    const completedAt = study.completedAt ? new Date(study.completedAt) : now
    waitingForStudies += Math.floor((completedAt.getTime() - requestedAt.getTime()) / 60000)
  })

  // Tiempo esperando revisión médica
  let waitingForReview = 0
  studies.forEach((study) => {
    if (study.completedAt && !study.reviewedAt) {
      const completedAt = new Date(study.completedAt)
      waitingForReview += Math.floor((now.getTime() - completedAt.getTime()) / 60000)
    } else if (study.completedAt && study.reviewedAt) {
      const completedAt = new Date(study.completedAt)
      const reviewedAt = new Date(study.reviewedAt)
      waitingForReview += Math.floor((reviewedAt.getTime() - completedAt.getTime()) / 60000)
    }
  })

  // Tiempo que tomaron los estudios en progreso
  let studiesInProgress = 0
  studies.forEach((study) => {
    if (study.inProgressAt && study.completedAt) {
      const inProgressAt = new Date(study.inProgressAt)
      const completedAt = new Date(study.completedAt)
      studiesInProgress += Math.floor((completedAt.getTime() - inProgressAt.getTime()) / 60000)
    }
  })

  // Tiempo promedio por estudio
  const completedStudies = studies.filter((s) => s.completedAt).length
  const averageStudyTime = completedStudies > 0 ? Math.floor(waitingForStudies / completedStudies) : 0

  return {
    totalTime,
    waitingForStudies,
    waitingForReview,
    studiesInProgress,
    averageStudyTime,
  }
}

/**
 * Calcula la duración en minutos entre dos timestamps
 */
function calculateDuration(from: string, to: string): number {
  const fromTime = new Date(from)
  const toTime = new Date(to)
  return Math.floor((toTime.getTime() - fromTime.getTime()) / 60000)
}

/**
 * Formatea una duración en minutos a un string legible
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Obtiene el color para un tipo de evento
 */
export function getEventColor(type: TimelineEvent["type"]): string {
  const colors: Record<TimelineEvent["type"], string> = {
    admission: "text-primary",
    doctor_assigned: "text-accent",
    study_requested: "text-warning",
    study_in_progress: "text-info",
    study_completed: "text-success",
    study_reviewed: "text-success",
    all_completed: "text-success",
    discharge: "text-muted-foreground",
  }
  return colors[type] || "text-foreground"
}

/**
 * Obtiene el ícono para un tipo de evento
 */
export function getEventIcon(type: TimelineEvent["type"]): string {
  const icons: Record<TimelineEvent["type"], string> = {
    admission: "UserPlus",
    doctor_assigned: "Stethoscope",
    study_requested: "FileText",
    study_in_progress: "Clock",
    study_completed: "CheckCircle",
    study_reviewed: "Eye",
    all_completed: "CheckCircle2",
    discharge: "UserX",
  }
  return icons[type] || "Circle"
}
