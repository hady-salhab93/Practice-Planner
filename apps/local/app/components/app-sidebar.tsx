import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router";
import { CalendarDays, ChevronRight, Library, Menu, X } from "lucide-react";

function Navigation() {
  return (
    <nav className="sidebar-nav" aria-label="Primary navigation">
      <NavLink to="/" end className="sidebar-link">
        <Library aria-hidden="true" size={16} />
        <span>Library</span>
        <ChevronRight aria-hidden="true" size={14} />
      </NavLink>
      <NavLink to="/sprints" className="sidebar-link">
        <CalendarDays aria-hidden="true" size={16} />
        <span>Sprints</span>
        <ChevronRight aria-hidden="true" size={14} />
      </NavLink>
    </nav>
  );
}

export function AppSidebar() {
  const panelRef = useRef<HTMLDialogElement>(null);
  const location = useLocation();

  useEffect(() => {
    panelRef.current?.close();
  }, [location.key]);

  return (
    <>
      <aside className="app-sidebar">
        <p className="sidebar-brand">Practice Planner</p>
        <Navigation />
      </aside>
      <div className="mobile-app-header">
        <button
          className="button button-secondary panel-close"
          type="button"
          aria-label="Open navigation"
          aria-haspopup="dialog"
          onClick={() => panelRef.current?.showModal()}
        >
          <Menu aria-hidden="true" size={18} />
        </button>
        <span className="sidebar-brand">Practice Planner</span>
      </div>
      <dialog
        ref={panelRef}
        className="navigation-panel"
        aria-labelledby="navigation-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            panelRef.current?.close();
          }
        }}
      >
        <header className="material-panel-header">
          <h2 id="navigation-title">Navigation</h2>
          <button
            className="button button-secondary panel-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => panelRef.current?.close()}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        <Navigation />
      </dialog>
    </>
  );
}
