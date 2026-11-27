"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MEMBER_DEPARTMENTS, MEMBER_EMPLOYMENT_TYPES, MEMBER_LOCATIONS, MEMBER_ROLES,
  type Member, type MemberStatus, type MemberUpsertInput,
} from "@/mocks/members";

const inputLabelClass = "block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground";

export const MEMBER_STATUS_OPTIONS: ReadonlyArray<{ value: MemberStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "invited", label: "Invited" },
  { value: "inactive", label: "Inactive" },
];

export function MemberFormDialog({ open, onOpenChange, initial, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Member | null;
  onSubmit: (input: MemberUpsertInput, id: string | null) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState<Member["department"]>("Engineering");
  const [role, setRole] = useState<Member["role"]>("Engineer");
  const [employmentType, setEmploymentType] = useState<Member["employmentType"]>("Full-time");
  const [status, setStatus] = useState<MemberStatus>("active");
  const [location, setLocation] = useState<string>("Karachi");
  const [onCall, setOnCall] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(initial?.fullName ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setJobTitle(initial?.jobTitle ?? "");
    setDepartment(initial?.department ?? "Engineering");
    setRole(initial?.role ?? "Engineer");
    setEmploymentType(initial?.employmentType ?? "Full-time");
    setStatus(initial?.status ?? "active");
    setLocation(initial?.location ?? "Karachi");
    setOnCall(initial?.onCall ?? false);
  }, [open, initial]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanTitle = jobTitle.trim();
    if (!cleanName || !cleanEmail || !cleanTitle) return;
    onSubmit({
      fullName: cleanName,
      email: cleanEmail,
      phone: phone.trim(),
      jobTitle: cleanTitle,
      department,
      role,
      employmentType,
      status,
      location,
      onCall,
    }, initial?.id ?? null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(34rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit member" : "Add member"}</DialogTitle>
          <DialogDescription>{initial ? "Update the member's profile, role and availability." : "Add a team member to the NEXUS organization."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={inputLabelClass}>
              Full name
              <Input autoFocus required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Ayesha Khan" aria-label="Full name" autoComplete="off" className="h-10 text-[0.875rem]" />
            </label>
            <label className={inputLabelClass}>
              Email
              <Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@nexus.io" aria-label="Email" autoComplete="off" className="h-10 text-[0.875rem]" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={inputLabelClass}>
              Phone
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+92 300 0000000" aria-label="Phone" autoComplete="off" className="h-10 text-[0.875rem]" />
            </label>
            <label className={inputLabelClass}>
              Job title
              <Input required value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. DevOps Engineer" aria-label="Job title" autoComplete="off" className="h-10 text-[0.875rem]" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={inputLabelClass}>
              Department
              <Select value={department} onValueChange={(value) => setDepartment(value as Member["department"])}>
                <SelectTrigger aria-label="Department" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_DEPARTMENTS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Role
              <Select value={role} onValueChange={(value) => setRole(value as Member["role"])}>
                <SelectTrigger aria-label="Role" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={inputLabelClass}>
              Employment
              <Select value={employmentType} onValueChange={(value) => setEmploymentType(value as Member["employmentType"])}>
                <SelectTrigger aria-label="Employment type" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_EMPLOYMENT_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Status
              <Select value={status} onValueChange={(value) => setStatus(value as MemberStatus)}>
                <SelectTrigger aria-label="Status" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Location
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger aria-label="Location" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_LOCATIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pt-1 text-[0.8125rem] text-foreground">
            <input type="checkbox" checked={onCall} onChange={(event) => setOnCall(event.target.checked)} aria-label="Assign to on-call rotation" className="h-4 w-4 accent-[var(--primary)]" />
            <span>Assign to on-call rotation <span className="text-[0.75rem] text-muted-foreground">(counts toward On-Call Now)</span></span>
          </label>
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initial ? "Save changes" : "Add Member"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
