-- AI accounts can participate in the same bazaar auction ledger.
alter table public.bazaar_auctions alter column seller_id drop not null;
alter table public.bazaar_auctions add column if not exists seller_ai_id integer references public.ai_accounts(account_id);
alter table public.bazaar_auctions add column if not exists highest_bidder_ai_id integer references public.ai_accounts(account_id);
alter table public.bazaar_auctions drop constraint if exists bazaar_auctions_check;
alter table public.bazaar_auctions add constraint bazaar_auctions_participant_check check (
  ((seller_id is not null)::integer + (seller_ai_id is not null)::integer = 1)
  and ((highest_bid = 0 and highest_bidder_id is null and highest_bidder_ai_id is null)
    or (highest_bid > 0 and ((highest_bidder_id is not null)::integer + (highest_bidder_ai_id is not null)::integer = 1)))
);
create index if not exists bazaar_auctions_ai_seller_idx on public.bazaar_auctions(seller_ai_id,status);
create index if not exists bazaar_auctions_ai_bidder_idx on public.bazaar_auctions(highest_bidder_ai_id,status);

create or replace function public.create_ai_bazaar_auction(p_ai_id integer,p_item_id text,p_is_cosmetic boolean,p_starting_price bigint,p_duration_hours integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.ai_accounts%rowtype; assets jsonb; qty bigint; current_qty bigint; new_id uuid;
begin
 if p_starting_price<1 or p_starting_price>1000000000 or p_duration_hours<1 or p_duration_hours>72
 then raise exception 'BAZAAR_AUCTION_INVALID_SETTINGS'; end if;
 if p_item_id is null or length(p_item_id)<1 or length(p_item_id)>120 or p_item_id ~ '[[:cntrl:]]'
 then raise exception 'BAZAAR_AUCTION_INVALID_ASSET'; end if;
 select * into a from public.ai_accounts where account_id=p_ai_id for update;
 if not found then raise exception 'AI_ACCOUNT_MISSING'; end if;
 if (select count(*) from public.bazaar_auctions where seller_ai_id=p_ai_id and status='open' and ends_at>now())>=3
 then raise exception 'BAZAAR_AUCTION_LIMIT'; end if;
 if p_is_cosmetic then
   current_qty:=case when coalesce(a.trade_cosmetics->>p_item_id,'false') in ('true','1') then 1 else 0 end;
   if current_qty<1 then raise exception 'BAZAAR_AUCTION_COSMETIC_UNAVAILABLE'; end if;
   update public.ai_accounts set trade_cosmetics=coalesce(trade_cosmetics,'{}'::jsonb)-p_item_id,updated_at=now() where account_id=p_ai_id;
   assets:=jsonb_build_object('coins',0,'xp',0,'items','{}'::jsonb,'cosmetics',jsonb_build_object(p_item_id,1));
 else
   current_qty:=coalesce((a.inventory_items #>> string_to_array(p_item_id,':'))::bigint,0);
   if current_qty<1 then raise exception 'BAZAAR_AUCTION_ITEM_UNAVAILABLE'; end if;
   update public.ai_accounts set inventory_items=public.trade_jsonb_adjust(coalesce(inventory_items,'{}'::jsonb),string_to_array(p_item_id,':'),-1),updated_at=now() where account_id=p_ai_id;
   assets:=jsonb_build_object('coins',0,'xp',0,'items',jsonb_build_object(p_item_id,1),'cosmetics','{}'::jsonb);
 end if;
 insert into public.bazaar_auctions(seller_id,seller_ai_id,offered_assets,starting_price,ends_at)
 values(null,p_ai_id,assets,p_starting_price,now()+make_interval(hours=>p_duration_hours)) returning id into new_id;
 return new_id;
end $$;

create or replace function public.bid_ai_bazaar_auction(p_auction_id uuid,p_bidder_ai_id integer,p_bid bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.bazaar_auctions%rowtype; bidder public.ai_accounts%rowtype;
begin
 select * into a from public.bazaar_auctions where id=p_auction_id for update;
 if not found or a.status<>'open' then raise exception 'BAZAAR_AUCTION_NOT_OPEN'; end if;
 if a.ends_at<=now() then raise exception 'BAZAAR_AUCTION_ENDED'; end if;
 if a.seller_ai_id=p_bidder_ai_id then raise exception 'BAZAAR_AUCTION_SELF_BID'; end if;
 if p_bid<greatest(a.starting_price,a.highest_bid+1) or p_bid>1000000000 then raise exception 'BAZAAR_AUCTION_BID_TOO_LOW'; end if;
 select * into bidder from public.ai_accounts where account_id=p_bidder_ai_id for update;
 if not found then raise exception 'AI_ACCOUNT_MISSING'; end if;
 if a.highest_bidder_id is not null then
   update public.trade_profiles set coins=coins+a.highest_bid,updated_at=now() where user_id=a.highest_bidder_id;
 elsif a.highest_bidder_ai_id is not null and a.highest_bidder_ai_id<>p_bidder_ai_id then
   update public.ai_accounts set coins=coins+a.highest_bid,updated_at=now() where account_id=a.highest_bidder_ai_id;
 end if;
 if a.highest_bidder_ai_id=p_bidder_ai_id then
   update public.ai_accounts set coins=coins-(p_bid-a.highest_bid),updated_at=now() where account_id=p_bidder_ai_id and coins>=p_bid-a.highest_bid;
 else
   update public.ai_accounts set coins=coins-p_bid,updated_at=now() where account_id=p_bidder_ai_id and coins>=p_bid;
 end if;
 if not found then raise exception 'BAZAAR_AUCTION_INSUFFICIENT_COINS'; end if;
 update public.bazaar_auctions set highest_bid=p_bid,highest_bidder_id=null,highest_bidder_ai_id=p_bidder_ai_id where id=p_auction_id;
 return jsonb_build_object('ok',true,'highest_bid',p_bid);
end $$;

create or replace function public.finalize_bazaar_auction(p_auction_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 a public.bazaar_auctions%rowtype; seller public.trade_profiles%rowtype; buyer public.trade_profiles%rowtype;
 seller_ai public.ai_accounts%rowtype; buyer_ai public.ai_accounts%rowtype;
 k text; n bigint; items jsonb; cosmetics jsonb; qty bigint; buyer_exists boolean:=false;
begin
 select * into a from public.bazaar_auctions where id=p_auction_id for update;
 if not found then return jsonb_build_object('ok',false,'error','NOT_FOUND'); end if;
 if a.status<>'open' or a.ends_at>now() then return jsonb_build_object('ok',true,'status',a.status); end if;
 items:=coalesce(a.offered_assets->'items','{}'::jsonb); cosmetics:=coalesce(a.offered_assets->'cosmetics','{}'::jsonb);
 if a.seller_id is not null then select * into seller from public.trade_profiles where user_id=a.seller_id for update;
 else select * into seller_ai from public.ai_accounts where account_id=a.seller_ai_id for update; end if;
 if a.seller_id is not null and not found then update public.bazaar_auctions set status='expired',completed_at=now() where id=a.id; return jsonb_build_object('ok',false,'error','SELLER_MISSING'); end if;
 if a.seller_ai_id is not null and not found then update public.bazaar_auctions set status='expired',completed_at=now() where id=a.id; return jsonb_build_object('ok',false,'error','SELLER_MISSING'); end if;
 if a.highest_bidder_id is null and a.highest_bidder_ai_id is null then
   if a.seller_id is not null then
     for k,n in select key,value::text::bigint from jsonb_each_text(items) loop seller.inventory:=public.trade_jsonb_adjust(coalesce(seller.inventory,'{}'::jsonb),string_to_array(k,':'),n); end loop;
     for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop qty:=case when jsonb_typeof(seller.cosmetics->k)='number' then (seller.cosmetics->>k)::bigint when coalesce(seller.cosmetics->>k,'false') in ('true','1') then 1 else 0 end; seller.cosmetics:=jsonb_set(coalesce(seller.cosmetics,'{}'::jsonb),array[k],to_jsonb(qty+n),true); end loop;
     update public.trade_profiles set inventory=seller.inventory,cosmetics=seller.cosmetics,updated_at=now() where user_id=seller.user_id;
   else
     for k,n in select key,value::text::bigint from jsonb_each_text(items) loop seller_ai.inventory_items:=public.trade_jsonb_adjust(coalesce(seller_ai.inventory_items,'{}'::jsonb),string_to_array(k,':'),n); end loop;
     update public.ai_accounts set inventory_items=seller_ai.inventory_items,trade_cosmetics=coalesce(seller_ai.trade_cosmetics,'{}'::jsonb)|| (select coalesce(jsonb_object_agg(key,true),'{}'::jsonb) from jsonb_each(cosmetics)),updated_at=now() where account_id=seller_ai.account_id;
   end if;
   update public.bazaar_auctions set status='expired',completed_at=now() where id=a.id;
   return jsonb_build_object('ok',true,'status','expired','no_bids',true);
 end if;
 if a.highest_bidder_id is not null then
   select * into buyer from public.trade_profiles where user_id=a.highest_bidder_id for update;
   buyer_exists:=found;
 else
   select * into buyer_ai from public.ai_accounts where account_id=a.highest_bidder_ai_id for update;
   buyer_exists:=found;
 end if;
 if not buyer_exists then
   if a.highest_bidder_id is not null then update public.trade_profiles set coins=coins+a.highest_bid,updated_at=now() where user_id=a.highest_bidder_id;
   else update public.ai_accounts set coins=coins+a.highest_bid,updated_at=now() where account_id=a.highest_bidder_ai_id; end if;
   update public.bazaar_auctions set status='expired',completed_at=now() where id=a.id;
   return jsonb_build_object('ok',false,'error','WINNER_MISSING');
 end if;
 if a.highest_bidder_id is not null then
   for k,n in select key,value::text::bigint from jsonb_each_text(items) loop buyer.inventory:=public.trade_jsonb_adjust(coalesce(buyer.inventory,'{}'::jsonb),string_to_array(k,':'),n); end loop;
   for k,n in select key,value::text::bigint from jsonb_each_text(cosmetics) loop qty:=case when jsonb_typeof(buyer.cosmetics->k)='number' then (buyer.cosmetics->>k)::bigint when coalesce(buyer.cosmetics->>k,'false') in ('true','1') then 1 else 0 end; buyer.cosmetics:=jsonb_set(coalesce(buyer.cosmetics,'{}'::jsonb),array[k],to_jsonb(qty+n),true); end loop;
   update public.trade_profiles set inventory=buyer.inventory,cosmetics=buyer.cosmetics,updated_at=now() where user_id=buyer.user_id;
 else
   for k,n in select key,value::text::bigint from jsonb_each_text(items) loop buyer_ai.inventory_items:=public.trade_jsonb_adjust(coalesce(buyer_ai.inventory_items,'{}'::jsonb),string_to_array(k,':'),n); end loop;
   update public.ai_accounts set inventory_items=buyer_ai.inventory_items,trade_cosmetics=coalesce(trade_cosmetics,'{}'::jsonb)|| (select coalesce(jsonb_object_agg(key,true),'{}'::jsonb) from jsonb_each(cosmetics)),updated_at=now() where account_id=buyer_ai.account_id;
 end if;
 if a.seller_id is not null then update public.trade_profiles set coins=coins+a.highest_bid,updated_at=now() where user_id=a.seller_id;
 else update public.ai_accounts set coins=coins+a.highest_bid,updated_at=now() where account_id=a.seller_ai_id; end if;
 update public.bazaar_auctions set status='completed',completed_at=now() where id=a.id;
 if a.highest_bidder_id is not null and a.seller_id is not null then
   insert into public.bazaar_history(listing_type,listing_id,buyer_player_id,seller_ai_id,offered_assets,requested_assets) values('player',a.id,a.highest_bidder_id,null,a.offered_assets,jsonb_build_object('coins',a.highest_bid));
 end if;
 return jsonb_build_object('ok',true,'status','completed','price',a.highest_bid);
end $$;

create or replace function public.bid_bazaar_auction(p_auction_id uuid,p_bidder_id uuid,p_bid bigint)
returns public.bazaar_auctions language plpgsql security definer set search_path='' as $$
declare a public.bazaar_auctions%rowtype; bidder public.trade_profiles%rowtype; charge bigint;
begin
 select * into a from public.bazaar_auctions where id=p_auction_id for update;
 if not found or a.status<>'open' then raise exception 'BAZAAR_AUCTION_NOT_OPEN'; end if;
 if a.ends_at<=now() then raise exception 'BAZAAR_AUCTION_ENDED'; end if;
 if a.seller_id=p_bidder_id then raise exception 'BAZAAR_AUCTION_SELF_BID'; end if;
 if p_bid<greatest(a.starting_price,a.highest_bid+1) or p_bid>1000000000 then raise exception 'BAZAAR_AUCTION_BID_TOO_LOW'; end if;
 select * into bidder from public.trade_profiles where user_id=p_bidder_id for update;
 if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;
 charge:=case when a.highest_bidder_id=p_bidder_id then p_bid-a.highest_bid else p_bid end;
 if bidder.coins<charge then raise exception 'BAZAAR_AUCTION_INSUFFICIENT_COINS'; end if;
 if a.highest_bidder_id is not null and a.highest_bidder_id<>p_bidder_id then update public.trade_profiles set coins=coins+a.highest_bid,updated_at=now() where user_id=a.highest_bidder_id;
 elsif a.highest_bidder_ai_id is not null then update public.ai_accounts set coins=coins+a.highest_bid,updated_at=now() where account_id=a.highest_bidder_ai_id; end if;
 update public.trade_profiles set coins=coins-charge,updated_at=now() where user_id=p_bidder_id;
 update public.bazaar_auctions set highest_bid=p_bid,highest_bidder_id=p_bidder_id,highest_bidder_ai_id=null where id=p_auction_id returning * into a;
 return a;
end $$;

revoke all on function public.create_ai_bazaar_auction(integer,text,boolean,bigint,integer) from public,anon,authenticated;
revoke all on function public.bid_ai_bazaar_auction(uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.create_ai_bazaar_auction(integer,text,boolean,bigint,integer) to service_role;
grant execute on function public.bid_ai_bazaar_auction(uuid,integer,bigint) to service_role;
