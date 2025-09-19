-- Функция для пополнения баланса пользователя
create or replace function credit_user_balance(p_user_id uuid, p_amount numeric)
returns void as $$
begin
  insert into ledger (user_id, type, amount_rub, status)
  values (p_user_id, 'credit_adjust', p_amount, 'done');

  update balances
  set available_rub = available_rub + p_amount
  where user_id = p_user_id;
end;
$$ language plpgsql;
