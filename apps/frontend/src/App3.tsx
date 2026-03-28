import { useEffect, useState } from "react"
import type { Course, CourseWorkWithSubmission, SubmissionAttachmentItem } from "shared"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

// ─────────────────────────────────────────────
// Helpers (UI)
// ─────────────────────────────────────────────

function formatDueDate(dueDate?: { year: number; month: number; day: number }) {
  if (!dueDate) return "Tidak ada deadline"
  return new Date(dueDate.year, dueDate.month - 1, dueDate.day).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  })
}

function stateLabel(state?: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    TURNED_IN: { label: "Dikumpulkan", variant: "default" },
    RETURNED: { label: "Dinilai", variant: "secondary" },
    CREATED: { label: "Belum Dikumpulkan", variant: "destructive" },
    NEW: { label: "Belum Dimulai", variant: "outline" },
    RECLAIMED_BY_STUDENT: { label: "Ditarik Kembali", variant: "outline" },
  }
  return map[state ?? ""] ?? { label: state ?? "–", variant: "outline" }
}

function AttachmentLink({ att }: { att: SubmissionAttachmentItem }) {
  if (att.driveFile) {
    return (
      <a href={att.driveFile.alternateLink} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-600 hover:underline text-sm">
        📄 {att.driveFile.title}
      </a>
    )
  }
  if (att.link) {
    return (
      <a href={att.link.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-600 hover:underline text-sm">
        🔗 {att.link.title || att.link.url}
      </a>
    )
  }
  if (att.youtubeVideo) {
    return (
      <a href={att.youtubeVideo.alternateLink} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 text-red-600 hover:underline text-sm">
        ▶ {att.youtubeVideo.title}
      </a>
    )
  }
  if (att.form) {
    return (
      <a href={att.form.responseUrl || att.form.formUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 text-green-600 hover:underline text-sm">
        📝 {att.form.title}
      </a>
    )
  }
  return null
}

function CourseWorkCard({ item }: { item: CourseWorkWithSubmission }) {
  const { courseWork, submission } = item
  const { label, variant } = stateLabel(submission?.state)
  const attachments = submission?.assignmentSubmission?.attachments ?? []
  const score = submission?.assignedGrade ?? submission?.draftGrade

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug wrap-break-word min-w-0">
            {courseWork.title}
          </CardTitle>
          <Badge variant={variant} className="shrink-0 whitespace-nowrap">
            {label}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-1">
          🗓 {formatDueDate(courseWork.dueDate)}
        </CardDescription>
      </CardHeader>
      <Separator className="shrink-0" />
      <ScrollArea className="flex-1 min-h-0">
        <CardContent className="flex flex-col gap-3 pt-3 pb-4">
          {courseWork.description && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground">DESKRIPSI</p>
              <p className="text-sm text-foreground whitespace-pre-wrap wrap-break-word line-clamp-4">
                {courseWork.description}
              </p>
            </div>
          )}
          {courseWork.materials && courseWork.materials.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground">LAMPIRAN TUGAS</p>
              <div className="flex flex-col gap-1">
                {courseWork.materials.map((mat, i) => {
                  const att: SubmissionAttachmentItem = {
                    driveFile: mat.driveFile?.driveFile,
                    link: mat.link,
                    youtubeVideo: mat.youtubeVideo,
                    form: mat.form ? { formUrl: mat.form.formUrl, title: mat.form.title, responseUrl: "" } : undefined,
                  }
                  return <AttachmentLink key={i} att={att} />
                })}
              </div>
            </div>
          )}
          {submission && (
            <div className="flex items-center gap-2 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground shrink-0">SKOR</p>
              {score !== undefined ? (
                <span className="text-sm font-bold text-primary">{score} / {courseWork.maxPoints ?? "–"}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Belum dinilai</span>
              )}
            </div>
          )}
          {attachments.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground">LAMPIRAN SUBMISI</p>
              <div className="flex flex-col gap-1">
                {attachments.map((att, i) => <AttachmentLink key={i} att={att} />)}
              </div>
            </div>
          )}
          {submission?.shortAnswerSubmission?.answer && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground">JAWABANMU</p>
              <p className="text-sm italic wrap-break-word">"{submission.shortAnswerSubmission.answer}"</p>
            </div>
          )}
          {submission?.late && (
            <div className="pt-1">
              <Badge variant="destructive" className="w-fit text-xs">⚠ Terlambat</Badge>
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Main Application Component
// ─────────────────────────────────────────────

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [items, setItems] = useState<CourseWorkWithSubmission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper: Fetch dengan otomatis menyertakan API KEY & Credentials
  const fetchWithKey = async (path: string, options: RequestInit = {}) => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL;
    const apiKey = import.meta.env.VITE_API_KEY;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    const response = await fetch(`${baseUrl}${cleanPath}?key=${apiKey}`, { 
      ...options,
      credentials: "include" 
    });
    return response.json();
  };

  // 1. Cek status login saat pertama kali buka
  useEffect(() => {
    fetchWithKey("/auth/me")
      .then((d) => setLoggedIn(d.loggedIn))
      .catch(() => setLoggedIn(false))
  }, [])

  // 2. Load daftar mata kuliah jika sudah login
  useEffect(() => {
    if (!loggedIn) return
    fetchWithKey("/classroom/courses")
      .then((d) => setCourses(d.data ?? []))
      .catch((err) => console.error("Error loading courses:", err))
  }, [loggedIn])
  

  // 3. Load tugas (submissions) berdasarkan mata kuliah yang dipilih
  const loadSubmissions = async (courseId: string) => {
    setSelectedCourse(courseId)
    setLoading(true)
    setError(null)
    try {
      const d = await fetchWithKey(`/classroom/courses/${courseId}/submissions`)
      if (d.error) throw new Error(d.error)
      setItems(d.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat mengambil data")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/login?key=${apiKey}`
  }

  const handleLogout = async () => {
    try {
      await fetchWithKey("/auth/logout", { method: "POST" })
    } finally {
      setLoggedIn(false)
      setCourses([])
      setItems([])
      setSelectedCourse(null)
    }
  }

  // --- RENDER LOGIC ---

  if (loggedIn === null) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Menghubungkan ke server...</p></div>
  }

  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Google Classroom Viewer</h1>
        <p className="text-muted-foreground">Silakan login untuk melihat tugas anda</p>
        <Button onClick={handleLogin} size="lg">🎓 Login dengan Google</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📚 Google Classroom Viewer</h1>
        <Button variant="outline" onClick={handleLogout}>Logout</Button>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-muted-foreground mb-2">PILIH MATA KULIAH</p>
        <div className="flex flex-wrap gap-2">
          {courses.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada mata kuliah.</p>}
          {courses.map((c) => (
            <Button
              key={c.id}
              variant={selectedCourse === c.id ? "default" : "outline"}
              size="sm"
              onClick={() => loadSubmissions(c.id)}
            >
              {c.name} {c.section && <span className="ml-1 text-xs opacity-70">· {c.section}</span>}
            </Button>
          ))}
        </div>
      </div>

      <Separator className="mb-6" />
      {error && <div className="mb-4 p-3 rounded bg-destructive/10 text-destructive text-sm">{error}</div>}
      {loading && <div className="text-center py-12 text-muted-foreground">Mengambil data tugas...</div>}

      {!loading && items.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-4">{items.length} tugas ditemukan</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => <CourseWorkCard key={item.courseWork.id} item={item} />)}
          </div>
        </>
      )}

      {!loading && selectedCourse && items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Belum ada tugas di mata kuliah ini.</div>
      )}
    </div>
  )
}