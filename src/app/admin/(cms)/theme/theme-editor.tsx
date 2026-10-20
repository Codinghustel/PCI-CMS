"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorSummary, FormField } from "@/components/admin/ui";
import { useEditorAction } from "@/components/admin/workflow";
import { saveThemeAction } from "@/app/admin/actions/site";
import { siteButtonClass } from "@/components/site/site-button";
import { COLOR_TOKENS, contrastWarnings, DEFAULT_THEME, FONT_OPTIONS, themeCssVariables, type ColorTokenKey, type ThemeTokens } from "@/lib/theme";

const HEX = /^#[0-9a-fA-F]{6}$/;
const selectCls = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function ThemeEditor({ initial }: { initial: ThemeTokens }) {
  const [theme, setTheme] = useState<ThemeTokens>(initial);
  const [draftHex, setDraftHex] = useState<Record<string, string>>({});
  const { state, errors, pending, run } = useEditorAction();
  const warnings = useMemo(() => contrastWarnings(theme), [theme]);
  const vars = useMemo(() => themeCssVariables(theme) as React.CSSProperties, [theme]);
  const dirty = JSON.stringify(theme) !== JSON.stringify(initial);

  const setColor = (key: ColorTokenKey, value: string) => {
    setDraftHex((d) => ({ ...d, [key]: value }));
    if (HEX.test(value)) setTheme((t) => ({ ...t, colors: { ...t.colors, [key]: value.toUpperCase() } }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <ErrorSummary state={state} />
        <Card>
          <CardHeader><CardTitle className="text-base">Colours</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {COLOR_TOKENS.map((t) => {
              const value = draftHex[t.key] ?? theme.colors[t.key];
              const invalid = !HEX.test(value) || !!errors[`colors.${t.key}`];
              return (
                <FormField key={t.key} label={t.label} htmlFor={`c-${t.key}`} help={"help" in t ? t.help : undefined} error={!HEX.test(value) ? ["Use #RRGGBB"] : errors[`colors.${t.key}`]}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${t.label} colour picker`}
                      value={theme.colors[t.key]}
                      onChange={(e) => setColor(t.key, e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                    />
                    <Input id={`c-${t.key}`} value={value} onChange={(e) => setColor(t.key, e.target.value)} className="font-mono uppercase" maxLength={7} aria-invalid={invalid} />
                  </div>
                </FormField>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Typography & shape</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Heading font" htmlFor="t-hf">
              <select id="t-hf" className={selectCls} value={theme.typography.headingFont} onChange={(e) => setTheme({ ...theme, typography: { ...theme.typography, headingFont: e.target.value as ThemeTokens["typography"]["headingFont"] } })}>
                {Object.entries(FONT_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="Body font" htmlFor="t-bf">
              <select id="t-bf" className={selectCls} value={theme.typography.bodyFont} onChange={(e) => setTheme({ ...theme, typography: { ...theme.typography, bodyFont: e.target.value as ThemeTokens["typography"]["bodyFont"] } })}>
                {Object.entries(FONT_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="Heading weight" htmlFor="t-hw">
              <select id="t-hw" className={selectCls} value={theme.typography.headingWeight} onChange={(e) => setTheme({ ...theme, typography: { ...theme.typography, headingWeight: e.target.value as ThemeTokens["typography"]["headingWeight"] } })}>
                {["300", "400", "500", "600", "700"].map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Heading style" htmlFor="t-ht">
              <select id="t-ht" className={selectCls} value={`${theme.typography.headingTransform}:${theme.typography.headingTracking}`} onChange={(e) => { const [tr, tk] = e.target.value.split(":"); setTheme({ ...theme, typography: { ...theme.typography, headingTransform: tr as "none" | "uppercase", headingTracking: tk as "normal" | "wide" } }); }}>
                <option value="none:normal">Sentence case</option>
                <option value="uppercase:wide">Uppercase, spaced</option>
                <option value="none:wide">Sentence case, spaced</option>
              </select>
            </FormField>
            <FormField label="Button shape" htmlFor="t-bs">
              <select id="t-bs" className={selectCls} value={theme.shape.buttonShape} onChange={(e) => setTheme({ ...theme, shape: { ...theme.shape, buttonShape: e.target.value as ThemeTokens["shape"]["buttonShape"] } })}>
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="pill">Pill</option>
              </select>
            </FormField>
            <FormField label="Button text" htmlFor="t-bt">
              <select id="t-bt" className={selectCls} value={theme.shape.buttonTransform} onChange={(e) => setTheme({ ...theme, shape: { ...theme.shape, buttonTransform: e.target.value as "none" | "uppercase" } })}>
                <option value="uppercase">Uppercase</option>
                <option value="none">Normal</option>
              </select>
            </FormField>
            <FormField label={`Corner radius (${theme.shape.radius}rem)`} htmlFor="t-r">
              <input id="t-r" type="range" min={0} max={1.5} step={0.05} value={theme.shape.radius} onChange={(e) => setTheme({ ...theme, shape: { ...theme.shape, radius: Number(e.target.value) } })} className="w-full" />
            </FormField>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || !dirty || Object.values(draftHex).some((v) => !HEX.test(v))} onClick={() => run("publish", () => saveThemeAction(theme))}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Publish theme
          </Button>
          <Button variant="outline" disabled={!dirty} onClick={() => { setTheme(initial); setDraftHex({}); }}><RotateCcw /> Discard changes</Button>
          <Button variant="ghost" onClick={() => { setTheme(DEFAULT_THEME); setDraftHex({}); }}>Reset to PCI defaults</Button>
        </div>
      </div>

      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        {warnings.length ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> Accessibility: low contrast</p>
            <ul className="mt-1 list-disc ps-5">
              {warnings.map((w) => <li key={w.label}>{w.label}: {w.ratio.toFixed(2)}:1 (needs {w.min}:1)</li>)}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">All key colour pairs meet WCAG AA contrast.</p>
        )}
        <div className="site overflow-hidden rounded-lg border shadow-sm" style={vars} aria-label="Theme preview">
          <div style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-sans)" }}>
            <div className="on-dark p-8" style={{ background: "var(--dark)", color: "var(--dark-foreground)" }}>
              <p className="eyebrow mb-3">Featured project</p>
              <h2 className="text-4xl">Grand Orchard, Islamabad</h2>
              <p className="mt-3 text-sm opacity-80">A landmark mixed-use development in DHA Phase 1.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className={siteButtonClass("accent", "sm")}>Enquire now</span>
                <span className={siteButtonClass("outline-light", "sm")}>Pay My Installment</span>
              </div>
            </div>
            <div className="space-y-4 p-8">
              <h3 className="text-3xl">Inspiring lifestyles</h3>
              <p className="text-sm">Body text uses the body font and colour. <a className="text-primary underline">Links use the primary colour.</a></p>
              <p className="text-sm text-muted-foreground">Muted text for captions and supporting copy.</p>
              <div className="flex flex-wrap gap-2">
                <span className={siteButtonClass("primary", "sm")}>Primary</span>
                <span className={siteButtonClass("outline", "sm")}>Outline</span>
                <span className="site-btn inline-flex h-9 items-center bg-secondary px-4 text-[0.7rem] text-secondary-foreground">Secondary</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border bg-card p-4 text-card-foreground" style={{ borderRadius: "var(--radius)" }}>
                  <p className="eyebrow">Residential</p>
                  <p className="heading mt-1 text-xl">Project card</p>
                  <p className="text-xs text-muted-foreground">Bahria Town, Islamabad</p>
                </div>
                <div className="bg-muted p-4" style={{ borderRadius: "var(--radius)" }}>
                  <p className="text-sm font-semibold">Muted surface</p>
                  <p className="text-xs text-muted-foreground">Used for alternating sections.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
