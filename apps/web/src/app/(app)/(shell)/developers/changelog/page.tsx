import { Badge } from "@/components/ui/badge";
import { API_CHANGELOG } from "@/content/api-changelog";
import { formatDate } from "@/lib/format";

export default function ChangelogPage() {
  return (
    <div>
      <div>
        <h2 className="text-base font-semibold">Changelog</h2>
        <p className="text-sm text-muted-foreground">What&apos;s new in the Voltx public API, release by release.</p>
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {API_CHANGELOG.map((entry) => (
          <div key={entry.version} className="flex gap-4">
            <div className="w-24 shrink-0 pt-0.5">
              <Badge variant="secondary">{entry.version}</Badge>
            </div>
            <div className="flex-1 border-l border-border pb-2 pl-4">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold">{entry.title}</h3>
                <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {entry.changes.map((change) => (
                  <li key={change} className="text-sm text-muted-foreground">
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
