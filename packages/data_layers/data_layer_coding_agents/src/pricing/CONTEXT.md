# Directory Context: `/packages/data_layers/data_layer_coding_agents/src/pricing`

## Purpose
Reads the public price list of the models of Claude Code and of Codex, and calculates the estimated cost in US dollars of tokens. It holds the rules of the prices. It does not open the SQLite file: `src/storage/model_price_database.rs` stores the versions.

## Key Exports & Entry Points
- `price_list_parser.rs`: `parse_price_list`, `content_hash`, and `PRICE_LIST_ADDRESS`. It keeps the providers `anthropic` and `openai`, and gives the prices in US dollars for one million tokens.
- `price_list_source.rs`: `PriceListSource`, `WebPriceListSource`, `FilePriceListSource`, and `price_list_source_of`, which gives a web source for an address that starts with `http://` or `https://`, and a file source for anything else.
- `price_table.rs`: `PriceTable`, which finds the price of a model and calculates a cost, and `without_date`.
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- A cost is `None` when the model has no price, and never zero. A chat that used one model without a price has no cost at all, because a partial cost would be too small.
- A model is found by its exact name, then by its name without the date `-YYYYMMDD` that ends it. The view `token_usage_with_cost` in `src/storage/token_usage_schema.rs` uses the same two steps, and a test compares the view with `PriceTable`.
- A price that the list does not give for the cache read, or for the cache write, is the price of the fresh input.
- Only `price_list_source.rs` reaches the network, and only for a web address. Every test gives a file or a fake source, so no test reaches the network.
- Nothing here imports from `src/storage/` or from `src/coding_agents/`.

## Background
- The folder comes from [issue 616](https://github.com/heidrun-org/heidrun/issues/616). It replaces the prices that `desktop_tauri` fetched and calculated alone.
- The price policy (current prices for all the history, versions kept, a failed fetch changes nothing) is in `docs/statistics/token_usage_and_cost.md`.
