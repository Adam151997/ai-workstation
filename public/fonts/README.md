# Proto Mono Font

This directory contains the Proto Mono font family used for the AI Workstation OS theme.

## Font Weights

| Weight | File | Usage |
|--------|------|-------|
| 300 | ProtoMono-Light | Subtle text |
| 400 | ProtoMono-Regular | Body text |
| 500 | ProtoMono-Medium | Emphasis |
| 600 | ProtoMono-SemiBold | Headings, titles |

## Required Files

- `ProtoMono-Light.woff2` / `.woff`
- `ProtoMono-Regular.woff2` / `.woff`
- `ProtoMono-Medium.woff2` / `.woff`
- `ProtoMono-SemiBold.woff2` / `.woff`

## Setup

Extract from `font.zip` in the project root:

```powershell
Expand-Archive -Path "font.zip" -DestinationPath "public/fonts" -Force
```

## Fallback

If Proto Mono is not available, the system falls back to:
- JetBrains Mono (loaded from Google Fonts)
- System monospace fonts
