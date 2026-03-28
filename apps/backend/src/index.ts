import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { prisma } from "../prisma/db";
import { createOAuthClient, getAuthUrl } from "./auth";
import { getCourses, getCourseWorks, getSubmissions } from "./classroom";
import type { ApiResponse, HealthCheck, User } from "shared";

// In-memory token store (Akan ter-reset jika serverless Vercel restart)
const tokenStore = new Map<
  string,
  { access_token: string; refresh_token?: string }
>();

const app = new Elysia()
  // !!! modifikasi CORS agar dapat di akses oleh web frontend deployment https
  .use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true, // WAJIB untuk /auth/me yang mengecek session/cookie
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  )


  // !!! tambahkan onRequest ini untuk beri pengamanan API_KEY data `/users`
  .onRequest(({ request, set }) => {
    const url = new URL(request.url);

    // Hanya proteksi jika path dimulai dengan /users
    if (url.pathname.startsWith("/users")) {
      const origin = request.headers.get("origin");
      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      const key = url.searchParams.get("key");

      // 1. Izinkan jika datang dari Frontend resmi (AJAX/Fetch)
      if (origin === frontendUrl) {
        return;
      }

      // 2. Jika tidak dari Frontend, WAJIB cek API_KEY
      if (key !== process.env.API_KEY) {
        set.status = 401;
        return { message: "Unauthorized: Access denied without valid API Key" };
      }
    }
  })

  // Health check
  .get("/", (): ApiResponse<HealthCheck> => ({
    data: { status: "ok" },
    message: "server running",
  }))

  // Users Route
  .get("/users", async () => {
    const users = await prisma.user.findMany();
    return { data: users, message: "User list retrieved" };
  })

  // --- AUTH ROUTES ---
  .get("/auth/login", ({ redirect }) => {
    const oauth2Client = createOAuthClient();
    return redirect(getAuthUrl(oauth2Client));
  })

  .get("/auth/callback", async ({ query, set, cookie: { session }, redirect }) => {
    const { code } = query as { code: string };

    if (!code) {
      set.status = 400;
      return { error: "Missing authorization code" };
    }

    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    const sessionId = crypto.randomUUID();
    tokenStore.set(sessionId, {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token ?? undefined,
    });

    if (!session) return;

    // Set cookie session
    session.value = sessionId;
    session.maxAge = 60 * 60 * 24; // 1 hari
    session.path = "/";

    // !!! Tambahkan KONFIGURASI PRODUCTION
    session.httpOnly = true;
    session.secure = true;    // WAJIB: Cookie hanya dikirim lewat HTTPS
    session.sameSite = "none"; // WAJIB: Agar cookie bisa dikirim antar domain berbeda

    // Redirect ke frontend menggunakan ENV var
    return redirect(`${process.env.FRONTEND_URL}/classroom`);
  })

  .get("/auth/me", ({ cookie: { session } }) => {
    const sessionId = session?.value as string;
    if (!sessionId || !tokenStore.has(sessionId)) {
      return { loggedIn: false };
    }
    return { loggedIn: true, sessionId };
  })

  // --- CLASSROOM ROUTES ---
  .get("/classroom/courses", async ({ cookie: { session }, set }) => {
    const tokens = tokenStore.get(session?.value as string);
    if (!tokens) {
      set.status = 401;
      return { error: "Unauthorized. Silakan login terlebih dahulu." };
    }
    const courses = await getCourses(tokens.access_token);
    return { data: courses, message: "Courses retrieved" };
  })

  .get("/classroom/courses/:courseId/submissions", async ({ params, cookie: { session }, set }) => {
    const tokens = tokenStore.get(session?.value as string);
    if (!tokens) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { courseId } = params;
    const [courseWorks, submissions] = await Promise.all([
      getCourseWorks(tokens.access_token, courseId),
      getSubmissions(tokens.access_token, courseId),
    ]);

    const submissionMap = new Map(submissions.map((s) => [s.courseWorkId, s]));
    const result = courseWorks.map((cw) => ({
      courseWork: cw,
      submission: submissionMap.get(cw.id) ?? null,
    }));

    return { data: result, message: "Course submissions retrieved" };
  });

// !!! tambahkan console log yang tidak tampil di production & pakai nilai dari ENV
if (process.env.NODE_ENV != "production") {
  app.listen(3000);
  console.log(`🦊 Backend → http://localhost:3000`);
  console.log(`🦊 FRONTEND_URL → ${process.env.FRONTEND_URL}`); 
  console.log(`🦊 DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`🦊 GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI}`);
}

// !!! tambahkan export app agar Elysia dapat dibaca Vercel serverless.
export default app;
export type App = typeof app;