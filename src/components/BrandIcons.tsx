import type { SVGProps } from 'react';

// Crisp, standardized 24x24 SVG brand icons for AI providers and web frameworks

export function GoogleGeminiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
        fill="url(#gemini-grad)"
      />
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1BA1E3" />
          <stop offset="0.5" stopColor="#5B76F7" />
          <stop offset="1" stopColor="#9C62F2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function OpenAIIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.475 4.475 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.47 4.47 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.6669zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1636a.0804.0804 0 0 1-.038-.0567V6.0748a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.4598a.7948.7948 0 0 0-.3927.6813v6.7219zm1.1449-2.0784l2.5486-1.4674 2.5486 1.4674v2.9348l-2.5486 1.4674-2.5486-1.4674z" />
    </svg>
  );
}

export function AnthropicClaudeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 4.5 12.016 14.28 9.28 9.384 11.232 5.9l-1.92-1.08L4.8 12.912l1.92 1.08 1.936-3.464 3.36 6.024 1.92-1.08 5.456-9.792-1.92-.18zM19.2 19.5H4.8v-1.6h14.4v1.6z" />
    </svg>
  );
}

export function NvidiaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.002 4.398c-4.704 0-8.627 3.32-9.61 7.747.886-3.084 3.69-5.352 7.042-5.352 4.048 0 7.33 3.28 7.33 7.327 0 2.21-.979 4.192-2.527 5.534 1.343-.886 2.37-2.22 2.872-3.793.18-.567.275-1.168.275-1.79 0-5.344-4.336-9.673-9.682-9.673zm-2.457 4.706c-2.43 0-4.4 1.97-4.4 4.4 0 1.25.522 2.378 1.363 3.178-.518-.588-.833-1.356-.833-2.199 0-1.84 1.492-3.332 3.332-3.332 1.096 0 2.065.53 2.67 1.343-.544-.84-1.482-1.39-2.532-1.39zm2.457 1.83a2.57 2.57 0 1 0 0 5.14 2.57 2.57 0 0 0 0-5.14zM4.09 12.12c0 4.37 3.54 7.91 7.91 7.91 3.23 0 6.01-1.93 7.23-4.7-.84 2.06-2.88 3.51-5.26 3.51-3.13 0-5.67-2.54-5.67-5.67 0-.37.04-.73.11-1.07A7.85 7.85 0 0 0 4.09 12.12z" />
    </svg>
  );
}

export function LocalServerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

export function ReactFrameworkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(0 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function NextjsFrameworkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.834 17.514L9.42 6.643h1.802l6.812 8.948v1.923zm-1.802 0l-5.618-7.378v7.378H8.612V6.643h1.802v2.339l.001 8.532h5.617z" />
    </svg>
  );
}

export function ViteFrameworkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M21.947 3.528a.75.75 0 0 0-.847-.078L12.43 8.358 4.298 3.447a.75.75 0 0 0-.964 1.155l8.132 16.264a.75.75 0 0 0 1.343 0l8.904-16.182a.75.75 0 0 0 .234-1.156z"
        fill="#FFD62E"
      />
      <path
        d="M14.773 2.502l-6.84 3.738-1.572 7.747 5.17-2.825 3.242-8.66z"
        fill="#BD34FE"
      />
      <path
        d="M13.633 2.05l-5.1 9.94 4.093-2.235-.993 7.818 5.76-11.233-3.76 2.05z"
        fill="#00C8FF"
      />
    </svg>
  );
}

export function ThreejsFrameworkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polygon points="12 2 2 8.5 12 15 22 8.5 12 2" />
      <polyline points="2 15.5 12 22 22 15.5" />
      <line x1="12" y1="15" x2="12" y2="22" />
    </svg>
  );
}
