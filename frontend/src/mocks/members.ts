export type MemberStatus = "active" | "on_leave" | "invited" | "inactive";
export type MemberDepartment = "Engineering" | "DevOps" | "Security" | "IT Support" | "HR" | "Finance" | "Management";
export interface Member { id: string; firstName: string; lastName: string; fullName: string; email: string; phone: string; avatarInitials: string; avatarColor: string; jobTitle: string; department: MemberDepartment; role: "Admin" | "Manager" | "Engineer" | "Analyst" | "Viewer"; employmentType: "Full-time" | "Part-time" | "Contractor" | "Intern"; status: MemberStatus; managerId: string | null; location: string; timezone: string; joinedAt: string; skills: string[]; onCall: boolean; notes: string; }
const names = [["Sara", "Iqbal", "Platform Engineering", "Manager", "active"], ["Tom", "Becker", "DevOps", "Admin", "active"], ["Marcus", "Lee", "Engineering", "Engineer", "active"], ["Priya", "Nair", "Security", "Analyst", "active"], ["Daniel", "Roth", "DevOps", "Engineer", "active"], ["Nina", "Park", "Security", "Viewer", "active"], ["Ayesha", "Khan", "Management", "Admin", "active"], ["Omar", "Farooq", "Engineering", "Engineer", "active"], ["Lena", "Fischer", "IT Support", "Engineer", "on_leave"], ["Raj", "Patel", "Finance", "Analyst", "on_leave"], ["Sara", "Khan", "Security", "Analyst", "invited"], ["Maya", "Chen", "Engineering", "Engineer", "invited"], ["Alex", "Morgan", "HR", "Manager", "active"], ["Hassan", "Raza", "DevOps", "Engineer", "active"], ["Emma", "Stone", "IT Support", "Viewer", "active"], ["Noah", "Williams", "Finance", "Analyst", "inactive"], ["Ibrahim", "Khan", "Engineering", "Engineer", "active"], ["Fatima", "Ali", "Management", "Manager", "active"]] as const;
const day = 86_400_000; const now = Date.now();
export const MEMBERS: Member[] = names.map(([firstName, lastName, department, role, status], index) => ({ id: `MEM-${1001 + index}`, firstName, lastName, fullName: `${firstName} ${lastName}`, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nexus.io`, phone: `+92 300 ${String(1000000 + index * 731).slice(0, 7)}`, avatarInitials: `${firstName[0]}${lastName[0]}`, avatarColor: ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700"][index % 4], jobTitle: role === "Manager" ? `${department} Manager` : `${department} ${role}`, department: department === "Platform Engineering" ? "Engineering" : department as MemberDepartment, role, employmentType: index === 11 ? "Intern" : index === 8 ? "Contractor" : "Full-time", status: status as MemberStatus, managerId: index === 0 ? null : "MEM-1001", location: ["Karachi", "Lahore", "Islamabad", "Remote"][index % 4], timezone: "PKT (UTC+5)", joinedAt: new Date(now - (30 + index * 21) * day).toISOString(), skills: ["Monitoring", "Incident response", "Cloud"].slice(0, 1 + index % 3), onCall: [1, 2, 4, 7].includes(index), notes: "Team member in the NEXUS infrastructure organization." }));
let store = [...MEMBERS];
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 201)));
export async function loadMembers(): Promise<Member[]> { await wait(); return store.map((member) => ({ ...member, skills: [...member.skills] })); }
export async function loadMember(id: string): Promise<Member | null> { await wait(); return store.find((member) => member.id === id) ?? null; }
export function deleteMember(id: string) { store = store.filter((member) => member.id !== id); }
export function changeMemberStatus(id: string, status: MemberStatus) { store = store.map((member) => member.id === id ? { ...member, status } : member); }
export function toggleMemberOnCall(id: string) { store = store.map((member) => member.id === id ? { ...member, onCall: !member.onCall } : member); }

/* --------------------------- create / update ------------------------------ */

export const MEMBER_DEPARTMENTS: readonly MemberDepartment[] = ["Engineering", "DevOps", "Security", "IT Support", "HR", "Finance", "Management"];
export const MEMBER_ROLES: readonly Member["role"][] = ["Admin", "Manager", "Engineer", "Analyst", "Viewer"];
export const MEMBER_EMPLOYMENT_TYPES: readonly Member["employmentType"][] = ["Full-time", "Part-time", "Contractor", "Intern"];
export const MEMBER_LOCATIONS = ["Karachi", "Lahore", "Islamabad", "Remote"] as const;

export interface MemberUpsertInput {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: MemberDepartment;
  role: Member["role"];
  employmentType: Member["employmentType"];
  status: MemberStatus;
  location: string;
  onCall: boolean;
}

const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700"];

const cloneMember = (member: Member): Member => ({ ...member, skills: [...member.skills] });

const initialsFor = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const colorFor = (fullName: string) => AVATAR_COLORS[[...fullName].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length];

export function nextMemberId(): string {
  const highest = store.reduce((max, member) => {
    const value = Number.parseInt(member.id.replace("MEM-", ""), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 1000);
  return `MEM-${highest + 1}`;
}

/** Create a member from the dialog input. */
export function createMember(input: MemberUpsertInput): Member {
  const name = input.fullName.trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const member: Member = {
    id: nextMemberId(),
    firstName,
    lastName: rest.join(" "),
    fullName: name,
    email: input.email.trim(),
    phone: input.phone.trim(),
    avatarInitials: initialsFor(name),
    avatarColor: colorFor(name),
    jobTitle: input.jobTitle.trim(),
    department: input.department,
    role: input.role,
    employmentType: input.employmentType,
    status: input.status,
    managerId: null,
    location: input.location,
    timezone: "PKT (UTC+5)",
    joinedAt: new Date().toISOString(),
    skills: [],
    onCall: input.onCall,
    notes: "",
  };
  store = [member, ...store];
  return cloneMember(member);
}

/** Update editable fields. Names/avatar derive from fullName. */
export function updateMember(id: string, input: MemberUpsertInput): void {
  const name = input.fullName.trim();
  const [firstName, ...rest] = name.split(/\s+/);
  store = store.map((member) => (member.id === id
    ? { ...member, ...input, fullName: name, email: input.email.trim(), phone: input.phone.trim(), jobTitle: input.jobTitle.trim(), firstName, lastName: rest.join(" "), avatarInitials: initialsFor(name), avatarColor: colorFor(name) }
    : member));
}

/** Clone of the store for consumers. */
export function readMembers(): Member[] {
  return store.map(cloneMember);
}