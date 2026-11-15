import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Variant = "primary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-glove text-chalk hover:bg-glove-dark",
  ghost: "border border-rope text-chalk hover:border-smoke",
  danger: "border border-glove text-glove hover:bg-glove hover:text-chalk",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-smoke">{label}</span>
      <input
        className="rounded-md border border-rope bg-ring px-3 py-2 text-chalk outline-none focus:border-glove"
        {...props}
      />
    </label>
  );
}

/** Password field with a show/hide toggle. */
export function PasswordInput({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  const { t } = useTranslation();
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="text-smoke">
        {label}
      </label>
      <div className="flex rounded-md border border-rope bg-ring focus-within:border-glove">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-chalk outline-none"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={visible}
          title={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          className="px-3 text-smoke hover:text-chalk"
        >
          {visible ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md rounded-xl border border-rope bg-canvas p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 font-display text-2xl tracking-wide uppercase">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-4xl tracking-wide uppercase">{title}</h1>
      {actions}
    </div>
  );
}
