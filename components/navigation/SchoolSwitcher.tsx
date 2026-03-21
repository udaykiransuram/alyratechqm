"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson } from "@/lib/client/api";
import { getSchoolKeyFromCookie, setSchoolKeyCookie } from "@/lib/client/school";
import { cn } from "@/lib/utils";

type SchoolOption = {
  key: string;
  displayName: string;
};

type SchoolSwitcherProps = {
  className?: string;
  showCreateButton?: boolean;
  onManageClick?: () => void;
};

export default function SchoolSwitcher({
  className,
  showCreateButton = true,
  onManageClick,
}: SchoolSwitcherProps) {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: "", displayName: "" });

  const { toast } = useToast();

  const currentSchool = useMemo(
    () => schools.find((school) => school.key === current) ?? null,
    [current, schools],
  );

  async function load() {
    try {
      const json = await fetchApiJson<any>("/api/schools", {
        cache: "no-store",
        schoolKey: "",
        fallbackMessage: "Failed to load schools.",
      });
      if (Array.isArray(json.schools)) {
        const nextSchools = json.schools
          .map((school: any) => ({
            key: String(school?.key || "").trim(),
            displayName: String(school?.displayName || school?.key || "").trim(),
          }))
          .filter(
            (school: SchoolOption) => school.key.length > 0 && school.displayName.length > 0,
          );

        setSchools(nextSchools);
      }
    } catch {
    }
  }

  useEffect(() => {
    setMounted(true);
    void load();
    setCurrent(getSchoolKeyFromCookie());
  }, []);

  function handleDialogChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !creating) {
      setForm({ key: "", displayName: "" });
    }
  }

  function onSelect(value: string) {
    setCurrent(value);
    setSchoolKeyCookie(value);
    window.location.reload();
  }

  async function createSchool() {
    const payload = {
      key: form.key.trim(),
      displayName: form.displayName.trim(),
    };

    if (!payload.key || !payload.displayName) {
      toast({
        title: "Validation Error",
        description: "Enter both a school key and a display name.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const json = await fetchApiJson<any>("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        schoolKey: "",
        fallbackMessage: "Failed to create school.",
      });

      toast({
        title: "School created",
        description: `${json.school.displayName} is now available in the switcher.`,
      });
      setForm({ key: "", displayName: "" });
      setOpen(false);
      await load();
    } catch (error: any) {
      toast({
        title: "Create failed",
        description: error?.message || "Could not create the school right now.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "w-full max-w-[28rem] min-w-0 rounded-xl border border-border/60 bg-card/70 p-1.5 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
            <span className="sr-only">School workspace</span>
          </div>

          <Select value={currentSchool?.key} onValueChange={onSelect}>
            <SelectTrigger
              className="h-9 min-w-0 flex-1 bg-background/80"
              title={
                currentSchool
                  ? currentSchool.displayName || currentSchool.key
                  : "Select school workspace"
              }
            >
              <SelectValue
                placeholder={
                  schools.length > 0 ? "Select school workspace" : "No schools available"
                }
              />
            </SelectTrigger>
            <SelectContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
              {schools.length > 0 ? (
                schools.map((school) => (
                  <SelectItem key={school.key} value={school.key}>
                    {school.displayName}
                  </SelectItem>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Create a school workspace to get started.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-1.5 max-sm:w-full">
          <Button
            asChild
            variant={showCreateButton ? "ghost" : "outline"}
            size="sm"
            className="h-9 shrink-0 px-3 max-sm:flex-1"
          >
            <Link href="/company/schools" title="Manage schools" onClick={onManageClick}>
              <Settings2 className="h-4 w-4" />
              <span className={cn(showCreateButton ? "hidden xl:inline" : "inline")}>
                Manage
              </span>
              <span className={cn(showCreateButton ? "sr-only xl:hidden" : "sr-only")}>
                Manage schools
              </span>
            </Link>
          </Button>

          {showCreateButton ? (
            <Dialog open={open} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button className="h-9 shrink-0 px-3 max-sm:flex-1" variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  <span className="hidden xl:inline">New School</span>
                  <span className="xl:hidden">New</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader className="text-left">
                  <DialogTitle>Create School</DialogTitle>
                  <DialogDescription>
                    Add a school workspace with a unique key and a friendly display name.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="app-field-group">
                    <label htmlFor="school-key" className="app-field-label">
                      School Key
                    </label>
                    <Input
                      id="school-key"
                      placeholder="e.g., alpha-high"
                      value={form.key}
                      onChange={(event) =>
                        setForm((currentForm) => ({ ...currentForm, key: event.target.value }))
                      }
                      disabled={creating}
                    />
                    <p className="text-sm text-muted-foreground">
                      Use a short permanent key for URLs, cookies, and environment-specific lookup.
                    </p>
                  </div>

                  <div className="app-field-group">
                    <label htmlFor="school-display-name" className="app-field-label">
                      Display Name
                    </label>
                    <Input
                      id="school-display-name"
                      placeholder="e.g., Alpha High School"
                      value={form.displayName}
                      onChange={(event) =>
                        setForm((currentForm) => ({ ...currentForm, displayName: event.target.value }))
                      }
                      disabled={creating}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDialogChange(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button onClick={createSchool} disabled={creating}>
                    {creating ? <Spinner /> : "Create School"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>
    </div>
  );
}
