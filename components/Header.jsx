import { Bell, ChevronDown, Menu, Moon, RefreshCw, Search, Sun } from 'lucide-react';

export default function Header({ onMenu, dark, onThemeToggle }) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
      <div className="search-box"><Search size={16} /><input placeholder="Search servers, alerts, logs, or anything..." /><kbd>Ctrl + K</kbd></div>
      <div className="topbar-spacer" />
      <button className="top-select"><i className="status-dot green" />Production<ChevronDown size={13} /></button>
      <select className="top-select period" defaultValue="Last 24 hours" aria-label="Dashboard period"><option>Last 24 hours</option><option>Last 7 days</option><option>Last 30 days</option></select>
      <button className="icon-btn refresh" aria-label="Refresh dashboard"><RefreshCw size={16} /></button>
      <button className="icon-btn notification" aria-label="Notifications"><Bell size={17} /><b>3</b></button>
      <span className="live-pill"><i />Live</span>
      <button className="icon-btn theme-toggle" onClick={onThemeToggle} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
      <button className="profile"><span className="avatar">A</span><span><b>Admin</b><small>Super Administrator</small></span><ChevronDown size={13} /></button>
    </header>
  );
}
