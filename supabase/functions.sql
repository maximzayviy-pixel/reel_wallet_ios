-- списание после подтверждения
create or replace function debit_user_balance(p_user_id uuid, p_amount numeric)
returns void as $$
begin
  update balances
  set available_rub = available_rub - p_amount,
      hold_rub = greatest(hold_rub - p_amount, 0)
  where user_id = p_user_id;
end; $$ language plpgsql;
