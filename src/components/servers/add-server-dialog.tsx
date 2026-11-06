"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { serverFilterOptions } from "@/data/mock/servers";

const environmentOptions = serverFilterOptions.environments.filter((value) => value !== "All");

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, environment: string) => void;
}

export function AddServerDialog({ open, onOpenChange, onAdd }: AddServerDialogProps) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("Production");

  // Reset the form whenever the dialog is reopened.
  useEffect(() => {
    if (open) {
      setName("");
      setEnvironment("Production");
    }
  }, [open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, environment);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Server</DialogTitle>
          <DialogDescription>Add a demo server to the mock inventory.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[10px] font-medium text-[#536780] dark:text-[#a9bcd2]">
            Server name
            <Input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. prod-api-02"
              className="h-[34px] text-[11px]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[10px] font-medium text-[#536780] dark:text-[#a9bcd2]">
            Environment
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="h-[34px] text-[11px]" aria-label="Environment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environmentOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" size="sm" className="h-[32px] text-[10px]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-[32px] text-[10px]">
              Add Server
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
