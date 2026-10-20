import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { mapEmbedUrl, telLink, type Office } from "@/lib/settings";

export function OfficeCards({ offices, showMap = false }: { offices: Office[]; showMap?: boolean }) {
  if (!offices.length) return null;
  return (
    <div className="space-y-6">
      {offices.map((office) => {
        const map = showMap ? mapEmbedUrl(office.mapQuery || office.address) : null;
        return (
          <div key={office.name} className="border border-border bg-card p-6 text-card-foreground">
            <h3 className="heading text-2xl">{office.name}</h3>
            <address className="mt-4 space-y-2.5 text-sm not-italic">
              {office.address ? <p className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><span className="whitespace-pre-line">{office.address}</span></p> : null}
              {office.phone ? (
                <p className="flex gap-2.5"><Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><a className="hover:text-primary" href={telLink(office.phone) ?? undefined} data-track="call_click" data-track-label={office.name}>{office.phone}</a></p>
              ) : null}
              {office.email ? <p className="flex gap-2.5"><Mail className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><a className="hover:text-primary" href={`mailto:${office.email}`}>{office.email}</a></p> : null}
              {office.hours ? <p className="flex gap-2.5 text-muted-foreground"><Clock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{office.hours}</p> : null}
            </address>
            {map ? (
              <iframe title={`Map of ${office.name}`} src={map} loading="lazy" className="mt-5 aspect-video w-full border-0" referrerPolicy="no-referrer-when-downgrade" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
