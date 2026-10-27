-- Allow players to accept public AI listings that request items or cosmetics.
-- Keep all ownership checks and transfers inside one SECURITY DEFINER transaction.
CREATE OR REPLACE FUNCTION public.settle_ai_trade_player(p_offer_id uuid, p_buyer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
 o public.ai_trade_offers%rowtype;
 s public.ai_accounts%rowtype;
 b public.trade_profiles%rowtype;
 k text;
 n bigint;
 requested_coins bigint;
 requested_xp bigint;
 offered_items jsonb;
 offered_cosmetics jsonb;
 requested_items jsonb;
 requested_cosmetics jsonb;
 s_inventory jsonb;
 s_cosmetics jsonb;
 b_inventory jsonb;
 b_cosmetics jsonb;
 cosmetic_owned jsonb;
begin
 select * into o from public.ai_trade_offers where id=p_offer_id for update;
 if not found or o.status <> 'open' then raise exception 'BAZAAR_LISTING_NOT_OPEN'; end if;
 if o.expires_at <= now() then update public.ai_trade_offers set status='expired' where id=o.id; raise exception 'BAZAAR_LISTING_EXPIRED'; end if;
 if o.buyer_ai_id is not null then raise exception 'BAZAAR_LISTING_NOT_PUBLIC'; end if;
 select * into s from public.ai_accounts where account_id=o.seller_ai_id for update;
 if not found then raise exception 'BAZAAR_AI_SELLER_MISSING'; end if;
 select * into b from public.trade_profiles where user_id=p_buyer_id for update;
 if not found then raise exception 'TRADE_PROFILE_MISSING'; end if;

 requested_coins:=coalesce((o.requested_assets->>'coins')::bigint,0);
 requested_xp:=coalesce((o.requested_assets->>'xp')::bigint,0);
 offered_items:=coalesce(o.offered_assets->'items','{}'::jsonb);
 offered_cosmetics:=coalesce(o.offered_assets->'cosmetics','{}'::jsonb);
 requested_items:=coalesce(o.requested_assets->'items','{}'::jsonb);
 requested_cosmetics:=coalesce(o.requested_assets->'cosmetics','{}'::jsonb);
 if coalesce((o.offered_assets->>'coins')::bigint,0)<>0
  or coalesce((o.offered_assets->>'xp')::bigint,0)<>0
  or requested_coins<0 or requested_xp<0
  or jsonb_typeof(offered_items)<>'object' or jsonb_typeof(offered_cosmetics)<>'object'
  or jsonb_typeof(requested_items)<>'object' or jsonb_typeof(requested_cosmetics)<>'object'
  or (requested_coins=0 and requested_xp=0 and requested_items='{}'::jsonb and requested_cosmetics='{}'::jsonb)
 then raise exception 'BAZAAR_UNSUPPORTED_ASSETS'; end if;
 if b.coins<requested_coins or b.xp<requested_xp then raise exception 'INSUFFICIENT_CURRENCY'; end if;

 s_inventory:=coalesce(s.inventory_items,'{}'::jsonb);
 s_cosmetics:=coalesce(s.trade_cosmetics,'{}'::jsonb);
 b_inventory:=coalesce(b.inventory,'{}'::jsonb);
 b_cosmetics:=coalesce(b.cosmetics,'{}'::jsonb);

 -- Validate all requested player assets before mutating either inventory.
 for k,n in select key,value::text::bigint from jsonb_each_text(requested_items) loop
  if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<1
   or coalesce((b_inventory #>> string_to_array(k,':'))::bigint,0)<n
   then raise exception 'BAZAAR_PLAYER_ITEM_UNAVAILABLE'; end if;
  if coalesce((s_inventory #>> string_to_array(k,':'))::bigint,0)>0
   then raise exception 'BAZAAR_AI_ALREADY_OWNS_ITEM'; end if;
 end loop;
 for k,cosmetic_owned in select key,value from jsonb_each(requested_cosmetics) loop
  if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or cosmetic_owned<>'true'::jsonb
   then raise exception 'BAZAAR_INVALID_COSMETIC'; end if;
  if coalesce(b_cosmetics->k,'false'::jsonb)<>'true'::jsonb
   then raise exception 'BAZAAR_PLAYER_COSMETIC_UNAVAILABLE'; end if;
  if coalesce(s_cosmetics->k,'false'::jsonb)='true'::jsonb
   then raise exception 'BAZAAR_AI_ALREADY_OWNS_COSMETIC'; end if;
 end loop;

 -- Transfer AI-offered items and cosmetics to the player.
 for k,n in select key,value::text::bigint from jsonb_each_text(offered_items) loop
  if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or n<1
   or coalesce((s_inventory #>> string_to_array(k,':'))::bigint,0)<n
   then raise exception 'BAZAAR_AI_ITEM_UNAVAILABLE'; end if;
  if coalesce((b_inventory #>> string_to_array(k,':'))::bigint,0)>0
   then raise exception 'BAZAAR_PLAYER_ALREADY_OWNS_ITEM'; end if;
  b_inventory:=public.trade_jsonb_adjust(b_inventory,string_to_array(k,':'),n);
  s_inventory:=public.trade_jsonb_adjust(s_inventory,string_to_array(k,':'),-n);
 end loop;
 for k,cosmetic_owned in select key,value from jsonb_each(offered_cosmetics) loop
  if length(k)<1 or length(k)>120 or k ~ '[[:cntrl:]]' or cosmetic_owned<>'true'::jsonb
   then raise exception 'BAZAAR_INVALID_COSMETIC'; end if;
  if coalesce(s_cosmetics->k,'false'::jsonb)<>'true'::jsonb
   then raise exception 'BAZAAR_COSMETIC_UNAVAILABLE'; end if;
  if coalesce(b_cosmetics->k,'false'::jsonb)='true'::jsonb
   then raise exception 'BAZAAR_PLAYER_ALREADY_OWNS_COSMETIC'; end if;
  s_cosmetics:=s_cosmetics-k;
  b_cosmetics:=jsonb_set(b_cosmetics,array[k],'true'::jsonb,true);
 end loop;

 -- Transfer requested items and cosmetics from the player to the AI.
 for k,n in select key,value::text::bigint from jsonb_each_text(requested_items) loop
  b_inventory:=public.trade_jsonb_adjust(b_inventory,string_to_array(k,':'),-n);
  s_inventory:=public.trade_jsonb_adjust(s_inventory,string_to_array(k,':'),n);
 end loop;
 for k in select key from jsonb_each(requested_cosmetics) loop
  b_cosmetics:=b_cosmetics-k;
  s_cosmetics:=jsonb_set(s_cosmetics,array[k],'true'::jsonb,true);
 end loop;

 update public.ai_accounts set coins=coins+requested_coins,player_xp=player_xp+requested_xp,
  inventory_items=s_inventory,trade_cosmetics=s_cosmetics,updated_at=now()
  where account_id=s.account_id;
 update public.trade_profiles set coins=coins-requested_coins,xp=xp-requested_xp,
  inventory=b_inventory,cosmetics=b_cosmetics,updated_at=now()
  where user_id=p_buyer_id;
 update public.ai_trade_offers set status='completed',completed_at=now() where id=o.id;
 insert into public.bazaar_history(listing_type,listing_id,buyer_player_id,seller_ai_id,offered_assets,requested_assets)
  values('ai',o.id,p_buyer_id,o.seller_ai_id,o.offered_assets,o.requested_assets);
 return jsonb_build_object('ok',true,'listing_id',o.id,'seller_type','ai');
end
$function$;
