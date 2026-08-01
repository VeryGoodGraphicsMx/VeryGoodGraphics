-- Cover the assignment-rule foreign key for updates and deletes on forms.
create index if not exists crm_assignment_rules_form_idx on public.crm_assignment_rules(form_id) where form_id is not null;
