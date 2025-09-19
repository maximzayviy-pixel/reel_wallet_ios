-- Функция для начисления бонусов
create or replace function grant_bonus_balance(p_user_id uuid, p_amount numeric)
returns void as $$
begin
  update balances
  set bonus_rub = bonus_rub + p_amount
  where user_id = p_user_id;
end;
$$ language plpgsql;
