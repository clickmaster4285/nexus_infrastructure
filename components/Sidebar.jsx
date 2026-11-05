import { useState } from 'react';
import { Activity, Boxes, ChevronDown, Settings2, ShieldCheck, X } from 'lucide-react';
import Icon from './Icon';
import { navGroups } from '@/mockdata/dashboard';

let lastExpandedSection = null;

export default function Sidebar({ active, onNavigate, mobileOpen, onClose }) {
  const [expandedSection, setExpandedSection] = useState(() => lastExpandedSection);

  function toggleGroup(title) {
    setExpandedSection(current => {
      const nextSection = current === title ? null : title;
      lastExpandedSection = nextSection;
      return nextSection;
    });
  }

  return (
    <>
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div><div className="brand-name">NEXUS</div><div className="brand-sub">Infrastructure Monitor</div></div>
          <button className="mobile-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav aria-label="Main navigation">{navGroups.map((group, index) => {
          const isExpanded = expandedSection === group.title;
          const submenuId = `sidebar-submenu-${index}`;
          return (
          <div className="nav-group" key={group.title}>
            <button
              type="button"
              className="nav-title nav-group-toggle"
              aria-expanded={isExpanded}
              aria-controls={submenuId}
              onClick={() => toggleGroup(group.title)}
            >
              {index === 0 ? <Icon name="layout-dashboard" size={15} /> : index === 1 ? <Boxes size={15} /> : index === 2 ? <Activity size={15} /> : index === 3 ? <Settings2 size={15} /> : <ShieldCheck size={15} />}
              <span>{group.title}</span><ChevronDown size={13} className="nav-chevron" aria-hidden="true" />
            </button>
            <div
              id={submenuId}
              className={`nav-submenu ${isExpanded ? 'expanded' : 'collapsed'}`}
              aria-hidden={!isExpanded}
              inert={!isExpanded}
            >
              <div className="nav-submenu-inner">
                {group.items.map(([label, icon]) => (
                  <button key={label} className={`nav-item ${active === label ? 'selected' : ''}`} onClick={() => onNavigate(label)}>
                    <Icon name={icon} size={14} /><span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );})}</nav>
        <div className="sidebar-bottom"><div className="system-status"><i />All systems operational</div><div className="version">Nexus Monitor <span>v2.4.0</span></div></div>
      </aside>
      {mobileOpen && <button className="scrim" aria-label="Close menu" onClick={onClose} />}
    </>
  );
}
