import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Github,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/documentos", icon: FileText, label: "Documentos" },
  { href: "/banco", icon: BookOpen, label: "Banco de preguntas" },
  { href: "/practica", icon: ChevronRight, label: "Modo práctica" },
  { href: "/progreso", icon: BarChart3, label: "Progreso" },
  { href: "/github", icon: Github, label: "GitHub Sync" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="display-lg text-foreground mb-2">ARQ·TEC</div>
          <div className="label-caps">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm w-full mx-4">
          {/* Logo block */}
          <div className="bg-foreground text-background p-8 mb-0">
            <div className="label-caps-sm mb-3" style={{ color: "oklch(0.55 0 0)" }}>
              Preparación de oposiciones
            </div>
            <div className="display-xl" style={{ color: "oklch(0.97 0 0)" }}>
              ARQ
            </div>
            <div className="display-xl" style={{ color: "oklch(0.97 0 0)", marginTop: "-0.2em" }}>
              TEC
            </div>
          </div>
          {/* Login block */}
          <div className="border border-border border-t-0 p-8 bg-card">
            <div className="rule-industrial mb-6" />
            <p className="label-caps mb-6">
              Arquitecto Técnico — Acceso al sistema de estudio
            </p>
            <a
              href={getLoginUrl()}
              className="btn-industrial w-full justify-center"
              style={{ display: "flex" }}
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          width: "220px",
          minWidth: "220px",
          background: "oklch(0.10 0 0)",
          borderRight: "2px solid oklch(0.22 0 0)",
          minHeight: "100vh",
        }}
      >
        {/* Logo */}
        <div className="p-5 border-b" style={{ borderColor: "oklch(0.22 0 0)" }}>
          <div
            className="display-md"
            style={{ color: "oklch(0.97 0 0)", fontSize: "1.6rem" }}
          >
            ARQ·TEC
          </div>
          <div className="label-caps-sm mt-1" style={{ color: "oklch(0.40 0 0)" }}>
            Oposiciones
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all`}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: isActive ? "oklch(0.97 0 0)" : "oklch(0.55 0 0)",
                    background: isActive ? "oklch(0.20 0 0)" : "transparent",
                    borderLeft: `3px solid ${isActive ? "oklch(0.90 0 0)" : "transparent"}`,
                  }}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 1.8} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t" style={{ borderColor: "oklch(0.22 0 0)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "oklch(0.30 0 0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900,
                fontSize: "0.9rem",
                color: "oklch(0.90 0 0)",
                flexShrink: 0,
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <div
                style={{
                  fontFamily: "'Barlow', sans-serif",
                  fontWeight: 500,
                  fontSize: "0.75rem",
                  color: "oklch(0.80 0 0)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.name ?? "Usuario"}
              </div>
              <div className="label-caps-sm" style={{ color: "oklch(0.40 0 0)" }}>
                {user?.role === "admin" ? "Admin" : "Estudiante"}
              </div>
            </div>
          </div>
          <button
            onClick={() => { void logout(); }}
            className="flex items-center gap-2 w-full"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "oklch(0.45 0 0)",
              background: "none",
              border: "none",
              padding: "0.4rem 0",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color =
                "oklch(0.70 0 0)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color =
                "oklch(0.45 0 0)")
            }
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          background: "oklch(0.10 0 0)",
          borderBottom: "2px solid oklch(0.22 0 0)",
        }}
      >
        <div
          className="display-md"
          style={{ color: "oklch(0.97 0 0)", fontSize: "1.2rem" }}
        >
          ARQ·TEC
        </div>
        <MobileNav location={location} />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:pt-0 pt-14 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function MobileNav({ location }: { location: string }) {
  return (
    <div className="flex gap-1">
      {NAV_ITEMS.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/" ? location === "/" : location.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}>
            <div
              className="p-2"
              style={{
                color: isActive ? "oklch(0.97 0 0)" : "oklch(0.50 0 0)",
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
