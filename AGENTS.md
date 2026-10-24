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
- Shared waiter-area bulbs are a list (`app_settings.shared_light_device_ids`) discovered by name; every sync sends the same command to all of them. Why: several SERVER bulbs must stay in lockstep and survive re-pairing in Smart Life.
- Physical button mapping is resolved by the existing per-table database configuration, never by a global bridge renumbering. Why: different physical button layouts must coexist without changing other tables.
- Call ingestion commits before best-effort SERVER dispatch; table SHOW commands remain separate. Mark shared dispatch sent only after every SERVER succeeds, scoped to commands existing at sync start. Why: light quota failures must not lose calls or falsely acknowledge partial dispatches.
- Smart Life local hub scenes (lights reacting offline) are configured and verified separately in Smart Life, never created from this app. Why: Lovable has no reliable official way to author local Zigbee scenes, so the app only handles cloud call/attend logic.
