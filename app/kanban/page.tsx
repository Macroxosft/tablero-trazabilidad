"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  CheckCircle,
  Activity,
  User,
  Stethoscope,
  FileText,
  Eye,
  UserCheck,
  UserX,
} from "lucide-react"
import { PatientTimeline } from "@/components/patient-timeline"

interface Study {
  id: string
  patientId: string
  name: string
  type: string
  status: "Solicitado" | "Pendiente Resultado" | "Completado"
  requestedAt: string
  completedAt?: string
  waitTime: number
  hasAlert: boolean
}

interface Doctor {
  id: string
  name: string
  specialty: string
  available: boolean
}

interface Patient {
  id: string
  name: string
  age: number
  gender: "M" | "F"
  insurance: string
  diagnosis: string
  severity: "Crítico" | "Urgente" | "Estable"
  room: string
  doctorId: string
  phone: string
  admissionTime: string
  status: "active" | "discharged"
  studies: Study[]
  doctor?: Doctor
  assignedToDoctorAt?: string
  firstStudyRequestedAt?: string
  allStudiesCompletedAt?: string
}

type KanbanStage =
  | "admission"
  | "waiting_doctor"
  | "in_studies"
  | "results_ready"
  | "in_progress"
  | "discharge"

export default function KanbanPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [timelinePatient, setTimelinePatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  // Load patients
  const loadPatients = useCallback(async () => {
    try {
      const res = await fetch("/api/patients")
      const data = await res.json()
      setPatients(data.patients || [])
    } catch (error) {
      console.error("Error loading patients:", error)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      await loadPatients()
      setLoading(false)
    }
    init()
  }, [loadPatients])

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      loadPatients()
    }, 3000)
    return () => clearInterval(interval)
  }, [loadPatients])

  // Determine patient stage
  const getPatientStage = (patient: Patient): KanbanStage => {
    if (patient.status === "discharged") {
      return "discharge"
    }

    const hasStudies = patient.studies.length > 0
    const allStudiesCompleted = hasStudies && patient.studies.every((s) => s.status === "Completado")
    const hasStudiesInProgress = hasStudies && patient.studies.some((s) => s.status === "Pendiente Resultado")
    const hasStudiesPending = hasStudies && patient.studies.some((s) => s.status === "Solicitado")

    // En Admisión - recién ingresado, sin médico asignado
    if (!patient.assignedToDoctorAt) {
      return "admission"
    }

    // Esperando Atención Médica - tiene médico pero no estudios solicitados
    if (!hasStudies) {
      return "waiting_doctor"
    }

    // En Estudios - tiene estudios pendientes o en proceso
    if (hasStudiesPending || hasStudiesInProgress) {
      return "in_studies"
    }

    // Resultados Listos - todos los estudios completados pero no revisados
    if (allStudiesCompleted && !patient.allStudiesCompletedAt) {
      return "results_ready"
    }

    // Atención en Progreso - estudios revisados, en tratamiento
    if (allStudiesCompleted && patient.allStudiesCompletedAt) {
      return "in_progress"
    }

    return "waiting_doctor"
  }

  // Group patients by stage
  const patientsByStage = useMemo(() => {
    const grouped: Record<KanbanStage, Patient[]> = {
      admission: [],
      waiting_doctor: [],
      in_studies: [],
      results_ready: [],
      in_progress: [],
      discharge: [],
    }

    patients.forEach((patient) => {
      const stage = getPatientStage(patient)
      grouped[stage].push(patient)
    })

    return grouped
  }, [patients])

  // Calculate time in current stage
  const getTimeInStage = (patient: Patient): number => {
    const now = Date.now()
    const stage = getPatientStage(patient)

    switch (stage) {
      case "admission":
        return Math.floor((now - new Date(patient.admissionTime).getTime()) / 60000)
      case "waiting_doctor":
        return Math.floor(
          (now - new Date(patient.assignedToDoctorAt || patient.admissionTime).getTime()) / 60000
        )
      case "in_studies":
        return Math.floor(
          (now - new Date(patient.firstStudyRequestedAt || patient.admissionTime).getTime()) / 60000
        )
      case "results_ready":
        const lastCompleted = Math.max(
          ...patient.studies.map((s) => new Date(s.completedAt || 0).getTime())
        )
        return Math.floor((now - lastCompleted) / 60000)
      case "in_progress":
        return Math.floor(
          (now - new Date(patient.allStudiesCompletedAt || patient.admissionTime).getTime()) / 60000
        )
      default:
        return 0
    }
  }

  const stages = [
    {
      id: "admission" as KanbanStage,
      title: "En Admisión",
      icon: User,
      color: "bg-blue-500/10 border-blue-500/20",
      headerColor: "bg-blue-500",
    },
    {
      id: "waiting_doctor" as KanbanStage,
      title: "Esperando Atención Médica",
      icon: Stethoscope,
      color: "bg-purple-500/10 border-purple-500/20",
      headerColor: "bg-purple-500",
    },
    {
      id: "in_studies" as KanbanStage,
      title: "En Estudios",
      icon: FileText,
      color: "bg-yellow-500/10 border-yellow-500/20",
      headerColor: "bg-yellow-500",
    },
    {
      id: "results_ready" as KanbanStage,
      title: "Resultados Listos / Esperando Revisión",
      icon: Eye,
      color: "bg-orange-500/10 border-orange-500/20",
      headerColor: "bg-orange-500",
    },
    {
      id: "in_progress" as KanbanStage,
      title: "Atención en Progreso",
      icon: Activity,
      color: "bg-cyan-500/10 border-cyan-500/20",
      headerColor: "bg-cyan-500",
    },
    {
      id: "discharge" as KanbanStage,
      title: "Alta / Derivación",
      icon: UserCheck,
      color: "bg-green-500/10 border-green-500/20",
      headerColor: "bg-green-500",
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando tablero Kanban...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Activity className="w-6 h-6 text-primary-foreground" />
                </div>
                Tablero Kanban - Flujo de Atención
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Vista de trazabilidad por etapas • Actualización en tiempo real
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Última actualización</div>
            <div className="text-xl font-semibold">{new Date().toLocaleTimeString("es-AR")}</div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stages.map((stage) => {
            const stagePatients = patientsByStage[stage.id]
            const Icon = stage.icon

            return (
              <div key={stage.id} className="flex flex-col">
                {/* Column Header */}
                <div className={`${stage.headerColor} text-white rounded-t-xl p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      <h3 className="font-semibold text-sm">{stage.title}</h3>
                    </div>
                    <div className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
                      {stagePatients.length}
                    </div>
                  </div>
                </div>

                {/* Column Content */}
                <div
                  className={`${stage.color} border rounded-b-xl p-3 min-h-[500px] max-h-[calc(100vh-300px)] overflow-y-auto space-y-3`}
                >
                  {stagePatients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Sin pacientes</p>
                    </div>
                  ) : (
                    stagePatients.map((patient) => {
                      const timeInStage = getTimeInStage(patient)
                      const hasAlerts = patient.studies.some((s) => s.hasAlert)
                      const pendingStudies = patient.studies.filter(
                        (s) => s.status !== "Completado"
                      ).length
                      const completedStudies = patient.studies.filter(
                        (s) => s.status === "Completado"
                      ).length
                      const inProgressStudies = patient.studies.filter(
                        (s) => s.status === "Pendiente Resultado"
                      ).length

                      return (
                        <div
                          key={patient.id}
                          onClick={() => setTimelinePatient(patient)}
                          className={`bg-card border rounded-lg p-3 cursor-pointer hover:shadow-lg transition-all flex flex-col min-h-[200px] ${hasAlerts ? "border-destructive/50 ring-2 ring-destructive/20" : "border-border"
                            } ${patient.severity === "Crítico"
                              ? "ring-2 ring-destructive/30"
                              : patient.severity === "Urgente"
                                ? "ring-2 ring-warning/30"
                                : ""
                            }`}
                        >
                          {/* Patient Name & Severity */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{patient.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {patient.age}a • {patient.gender}
                              </p>
                            </div>
                            <div
                              className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ml-2 ${patient.severity === "Crítico"
                                ? "bg-destructive/20 text-destructive"
                                : patient.severity === "Urgente"
                                  ? "bg-warning/20 text-warning"
                                  : "bg-success/20 text-success"
                                }`}
                            >
                              {patient.severity}
                            </div>
                          </div>

                          {/* Diagnosis */}
                          <div className="flex-grow">
                            <p className="text-xs text-foreground mb-2 line-clamp-2">
                              {patient.diagnosis}
                            </p>

                            {/* Time in Stage */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <Clock className="w-3 h-3" />
                              <span>
                                {timeInStage < 60
                                  ? `${timeInStage}m en esta etapa`
                                  : `${Math.floor(timeInStage / 60)}h ${timeInStage % 60}m en esta etapa`}
                              </span>
                            </div>

                            {/* Studies Status */}
                            {patient.studies.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                    <span>{patient.studies.length} estudios</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs flex-wrap">
                                  {pendingStudies > 0 && (
                                    <div className="flex items-center gap-1 text-destructive">
                                      <div className="w-2 h-2 rounded-full bg-destructive" />
                                      <span>{pendingStudies} pendiente{pendingStudies > 1 ? 's' : ''}</span>
                                    </div>
                                  )}
                                  {inProgressStudies > 0 && (
                                    <div className="flex items-center gap-1 text-warning">
                                      <div className="w-2 h-2 rounded-full bg-warning" />
                                      <span>{inProgressStudies} en proceso</span>
                                    </div>
                                  )}
                                  {completedStudies > 0 && (
                                    <div className="flex items-center gap-1 text-success">
                                      <div className="w-2 h-2 rounded-full bg-success" />
                                      <span>{completedStudies} completado{completedStudies > 1 ? 's' : ''}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Alert Indicator */}
                            {hasAlerts && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-destructive font-medium">
                                <AlertCircle className="w-3 h-3 animate-pulse" />
                                <span>Resultado anormal</span>
                              </div>
                            )}
                          </div>

                          {/* Room & Doctor */}
                          <div className="mt-auto pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{patient.room}</span>
                            </div>
                            {patient.doctor && (
                              <div className="flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" />
                                <span className="truncate">{patient.doctor.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Timeline Modal */}
      {timelinePatient && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setTimelinePatient(null)}
        >
          <div
            className="bg-background border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{timelinePatient.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {timelinePatient.diagnosis} • {timelinePatient.severity}
                </p>
              </div>
              <button
                onClick={() => setTimelinePatient(null)}
                className="p-2 rounded-lg hover:bg-secondary transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <PatientTimeline patient={timelinePatient} studies={timelinePatient.studies} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
