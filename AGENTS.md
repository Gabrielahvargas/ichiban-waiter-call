<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Tabit sales access lives only in `src/lib/tabit/adapter.server.ts` (`fetchSalesSince`); sync/ranking code depends on that interface. Why: Tabit has no public API, so the real contract can be dropped in without touching the rest.
- Sales items are classified at read time (`src/modules/sales/classify.ts`), not stored. Why: editing classification rules corrects past data immediately.
