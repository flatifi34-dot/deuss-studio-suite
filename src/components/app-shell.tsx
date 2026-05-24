import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Calendar, Users, LogOut, LayoutDashboard, Euro, Menu, History } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/calendar", label: "Calendar", icon: Calendar },
    { to: "/clients", label: "Clients", icon: Users },
    { to: "/revenue", label: isAdmin ? "Revenue" : "My revenue", icon: Euro },
    { to: "/history", label: "History", icon: History },
  ];

  const NavInner = (
    <>
      <div className="p-6 border-b border-border">
        <div className="font-display text-2xl text-primary leading-tight">Deuss Studio</div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">Massage CRM</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active = loc.pathname === l.to || loc.pathname.startsWith(l.to + "/");
          return (
            <Link
              key={l.to}
              to={l.to as any}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="px-3 py-2 mb-2">
          <div className="text-sm font-medium truncate">{profile?.full_name}</div>
          <div className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Therapist"}</div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={async () => {
            await signOut();
            nav({ to: "/login" });
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col shrink-0">
        {NavInner}
      </aside>
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur">
        <div className="font-display text-lg text-primary">Deuss Studio</div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            {NavInner}
          </SheetContent>
        </Sheet>
      </header>
      <main className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border">
      <div>
        <h1 className="font-display text-2xl sm:text-4xl text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm sm:text-base">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}