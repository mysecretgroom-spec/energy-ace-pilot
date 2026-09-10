import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { OCR_FIELD_LABELS, countIssues, type OcrIssue } from "@/lib/ocrIssues";

interface OcrIssuesBannerProps {
  issues: OcrIssue[] | undefined;
  /** Affiche un bandeau vert quand la lecture est complète */
  showSuccess?: boolean;
  className?: string;
}

export function OcrIssuesBanner({ issues, showSuccess = true, className }: OcrIssuesBannerProps) {
  const { errors, warnings, total } = countIssues(issues);

  if (total === 0) {
    if (!showSuccess) return null;
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground ${className ?? ""}`}>
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
        Lecture complète : tous les champs ont été reconnus.
      </div>
    );
  }

  const isError = errors > 0;

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        isError ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"
      } ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className={`h-4 w-4 shrink-0 ${isError ? "text-destructive" : "text-warning"}`} />
        {isError
          ? `Lecture incomplète : ${errors} champ${errors > 1 ? "s" : ""} à corriger`
          : `Lecture incertaine : ${warnings} point${warnings > 1 ? "s" : ""} à vérifier`}
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {(issues ?? []).map((issue, i) => (
          <li key={`${issue.field}-${i}`} className="flex gap-2">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                issue.level === "error" ? "bg-destructive" : "bg-warning"
              }`}
            />
            <span>
              <span className="font-medium text-foreground">
                {OCR_FIELD_LABELS[issue.field] ?? issue.field}
              </span>{" "}
              — {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
