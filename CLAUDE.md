# CLAUDE.md — Gestão de Atendimento — Parceiros (Vegas)

## Padrão visual obrigatório

Este projeto **deve seguir** o **VEGAS PLATFORM UI STANDARD**.

- **Versão consumida: v1.0**
- Documento canônico: `VEGAS-PLATFORM-UI-STANDARD.md` (raiz do repositório; cópia
  em `docs/VEGAS-PLATFORM-UI-STANDARD.docx`).

Toda a interface — telas, componentes, cores, tipografia, espaçamento, login,
layout, formulários, tabelas e feedbacks — deve obedecer a esse documento. Cada
projeto pode adaptar o conteúdo funcional, mas **não deve criar uma identidade
visual paralela**.

### Regras de implementação (resumo normativo)

- **Hexadecimais só existem em `src/styles/tokens.css`** (fonte canônica dos
  tokens). Componentes e o Tailwind leem das CSS vars — **nunca duplicar hex**.
- O `tailwind.config.ts` expõe os tokens como cores utilitárias lendo das CSS
  vars (prefixo `vg-`); não redefinir hex lá.
- Cores de **marca** (violeta/`brand`) identificam navegação e autoria;
  **status** usam a escala **semântica** própria — nunca usar cor de marca para
  status, nem o contrário.
- **Logo** apenas via componente único `src/components/brand/VegasLogo.tsx`.
  Nenhum outro arquivo referencia o caminho da imagem diretamente.
- **Tipografia:** Outfit (display) e Inter (interface) via `next/font`, seguindo
  a escala oficial (Display XL, H1, H2, H3, Body, Body Small, Caption).
- **Formulários:** label sempre visível (placeholder não substitui rótulo);
  borda de campo usa `--vg-border-field`.
- **Ícones:** biblioteca **Lucide** — não misturar com outras bibliotecas.
- Gradiente institucional apenas como assinatura discreta (faixa 2–3px).

### Governança

- Mudança de token ocorre **primeiro na fonte canônica** (`tokens.css`), de
  forma versionada.
- Ao atualizar o padrão, **registrar aqui a nova versão consumida**.

> Fase 1 (fundação visual + login) implementada sobre a v1.0. As telas internas
> serão migradas em fases seguintes.
