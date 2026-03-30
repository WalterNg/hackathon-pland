alter table public.market_symbols
add column if not exists sort_rank smallint not null default 9999;

create index if not exists market_symbols_sort_rank_idx
on public.market_symbols(sort_rank asc, base_asset asc, symbol asc);

update public.market_symbols
set sort_rank = case symbol
  when 'BTCUSDT' then 0
  when 'ETHUSDT' then 1
  when 'BNBUSDT' then 2
  when 'SOLUSDT' then 3
  when 'XRPUSDT' then 4
  when 'DOGEUSDT' then 5
  else sort_rank
end;
