"use client";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveTaskEdits } from "@/lib/tasks/actions";
import type { TaskView } from "@/lib/tasks/service";
import { editTaskSchema, MODEL_SUGGESTIONS, type EditTaskValues } from "@/lib/validations/task";

const valuesFor = (task: TaskView): EditTaskValues => ({ title: task.title, prompt: task.prompt,
  agent: task.agent, planModel: task.planModel ?? "", execModel: task.execModel ?? "", planFirst: task.planFirst });

export function EditTaskDialog({ task, onSaved }: { task: TaskView; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => valuesFor(task));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (task.status !== "failed" && task.status !== "cancelled") return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = editTaskSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setError("");
    startTransition(async () => {
      try {
        const result = await saveTaskEdits(task.id, parsed.data);
        if (!result.ok) { setError(result.error); return; }
        setOpen(false);
        toast.success("Tarefa salva", { description: "Use Rodar de novo para executar com as alterações." });
        onSaved();
      } catch { setError("Não foi possível salvar. Tente novamente."); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (pending) return;
      if (value) { setValues(valuesFor(task)); setError(""); }
      setOpen(value);
    }}>
      <DialogTrigger render={<Button variant="outline" />}><PencilIcon /> Editar</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
          <DialogDescription>A branch e os anexos serão mantidos. Depois de salvar, use Rodar de novo para iniciar uma nova sessão.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <fieldset disabled={pending} className="grid gap-4">
            <Field><FieldLabel htmlFor="edit-task-title">Título</FieldLabel>
              <Input id="edit-task-title" value={values.title} maxLength={200} onChange={(e) => setValues({ ...values, title: e.target.value })} />
            </Field>
            <Field><FieldLabel htmlFor="edit-task-prompt">Instruções</FieldLabel>
              <Textarea id="edit-task-prompt" value={values.prompt} rows={8} maxLength={50_000} onChange={(e) => setValues({ ...values, prompt: e.target.value })} />
            </Field>
            <Field><FieldLabel htmlFor="edit-task-agent">Agente</FieldLabel>
              <select id="edit-task-agent" className="h-9 rounded-md border bg-background px-3 text-sm" value={values.agent}
                onChange={(e) => setValues({ ...values, agent: e.target.value as EditTaskValues["agent"], planModel: "", execModel: "" })}>
                <option value="claude">Claude Code</option><option value="codex">Codex</option>
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="edit-plan-model">Modelo de planejamento</FieldLabel>
                <Input id="edit-plan-model" value={values.planModel} list="edit-task-models" placeholder="padrão da CLI" onChange={(e) => setValues({ ...values, planModel: e.target.value })} />
              </Field>
              <Field><FieldLabel htmlFor="edit-exec-model">Modelo de execução</FieldLabel>
                <Input id="edit-exec-model" value={values.execModel} list="edit-task-models" placeholder="padrão da CLI" onChange={(e) => setValues({ ...values, execModel: e.target.value })} />
              </Field>
            </div>
            <datalist id="edit-task-models">{MODEL_SUGGESTIONS[values.agent].map((model) => <option key={model} value={model} />)}</datalist>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={values.planFirst} onCheckedChange={(checked) => setValues({ ...values, planFirst: checked === true })} />Planejar antes de executar</label>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Salvar alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
