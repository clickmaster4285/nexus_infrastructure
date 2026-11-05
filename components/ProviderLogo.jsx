import { faAws } from '@fortawesome/free-brands-svg-icons';
import { siDigitalocean, siHetzner } from 'simple-icons';

export function ProviderLogo({ provider, variant }) {
  const type = provider.toLowerCase().replaceAll(' ', '-');
  const variantClass = variant ? ` ${variant}` : '';
  if (type === 'aws') return <svg className={`provider-logo-mark aws${variantClass}`} viewBox={`0 0 ${faAws.icon[0]} ${faAws.icon[1]}`} aria-hidden="true"><path d={faAws.icon[4]} fill="currentColor" /></svg>;
  if (type === 'hetzner') return <svg className={`provider-logo-mark hetzner${variantClass}`} viewBox="0 0 24 24" aria-hidden="true"><path d={siHetzner.path} fill="currentColor" /></svg>;
  if (type === 'digitalocean') return <svg className={`provider-logo-mark digitalocean${variantClass}`} viewBox="0 0 24 24" aria-hidden="true"><path d={siDigitalocean.path} fill="currentColor" /></svg>;
  return <OnPremIcon className="provider-logo-mark on-prem" />;
}

export function OnPremIcon({ className = '' }) {
  return <svg className={className} viewBox="0 0 20 20" aria-hidden="true"><path d="M2 7.5 10 2l8 5.5v1H2zM3.5 9.5h13v8h-13zM2 18.5h16v1H2z" fill="currentColor"/><path d="M5.3 11h1.5v2H5.3zm4 0h1.5v2H9.3zm4 0h1.5v2h-1.5zm-8 3.5h1.5v2H5.3zm4 0h1.5v2H9.3zm4 0h1.5v2h-1.5z" fill="white"/></svg>;
}

export function LocationFlag({ location }) {
  const country = location.split(',').at(-1).trim();
  if (country === 'Germany') return <svg className="location-flag" viewBox="0 0 18 12" role="img" aria-label="Germany"><path fill="#000" d="M0 0h18v4H0z"/><path fill="#DD0000" d="M0 4h18v4H0z"/><path fill="#FFCE00" d="M0 8h18v4H0z"/></svg>;
  if (country === 'Finland') return <svg className="location-flag" viewBox="0 0 18 12" role="img" aria-label="Finland"><path fill="#fff" d="M0 0h18v12H0z"/><path fill="#003580" d="M5 0h2v12H5zM0 5h18v2H0z"/></svg>;
  if (country === 'UK' || country === 'United Kingdom') return <svg className="location-flag" viewBox="0 0 18 12" role="img" aria-label="United Kingdom"><path fill="#012169" d="M0 0h18v12H0z"/><path d="m0 0 18 12M18 0 0 12" stroke="#fff" strokeWidth="3.2"/><path d="m0 0 18 12M18 0 0 12" stroke="#C8102E" strokeWidth="1.3"/><path stroke="#fff" strokeWidth="4" d="M9 0v12M0 6h18"/><path stroke="#C8102E" strokeWidth="2" d="M9 0v12M0 6h18"/></svg>;
  if (country === 'Pakistan') return <svg className="location-flag" viewBox="0 0 18 12" role="img" aria-label="Pakistan"><path fill="#01411C" d="M0 0h18v12H0z"/><path fill="#fff" d="M0 0h4v12H0z"/><circle cx="11.6" cy="6" r="3.7" fill="#fff"/><circle cx="12.8" cy="5" r="3.2" fill="#01411C"/><path fill="#fff" d="m14.7 2.2.5 1.1 1.2.1-.9.8.3 1.2-1.1-.6-1 .6.2-1.2-.9-.8 1.2-.1z"/></svg>;
  return null;
}
