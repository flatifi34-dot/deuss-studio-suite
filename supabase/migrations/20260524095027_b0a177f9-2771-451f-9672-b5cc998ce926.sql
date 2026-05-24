
-- Appointment change history
CREATE TABLE public.appointment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid,
  action text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  client_name text,
  therapist_name text,
  service_name text,
  room_name text,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  price numeric,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authed read history admins all, therapists own"
ON public.appointment_history
FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR changed_by = auth.uid() OR therapist_name IN (
  SELECT full_name FROM public.profiles WHERE id = auth.uid()
));

CREATE INDEX idx_appt_history_created_at ON public.appointment_history (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_appt record;
  v_client text;
  v_therapist text;
  v_service text;
  v_room text;
  v_changer text;
  v_diff jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_appt := NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      v_action := 'cancelled';
    ELSIF NEW.status = 'done' AND OLD.status <> 'done' THEN
      v_action := 'completed';
    ELSE
      v_action := 'updated';
    END IF;
    v_appt := NEW;
    v_diff := jsonb_build_object(
      'before', to_jsonb(OLD) - 'created_at' - 'created_by',
      'after',  to_jsonb(NEW) - 'created_at' - 'created_by'
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_appt := OLD;
  END IF;

  SELECT name INTO v_client FROM public.clients WHERE id = v_appt.client_id;
  SELECT full_name INTO v_therapist FROM public.profiles WHERE id = v_appt.therapist_id;
  SELECT name INTO v_service FROM public.services WHERE id = v_appt.service_id;
  SELECT name INTO v_room FROM public.rooms WHERE id = v_appt.room_id;
  SELECT full_name INTO v_changer FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.appointment_history (
    appointment_id, action, changed_by, changed_by_name,
    client_name, therapist_name, service_name, room_name,
    start_at, end_at, status, price, diff
  ) VALUES (
    v_appt.id, v_action, auth.uid(), v_changer,
    v_client, v_therapist, v_service, v_room,
    v_appt.start_at, v_appt.end_at, v_appt.status::text, v_appt.price, v_diff
  );
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_log_appointment_change
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_appointment_change();

-- Remove Valbona admin (keep single admin = admin@deuss.com / Denisa)
DELETE FROM public.user_roles
WHERE user_id IN (SELECT id FROM public.profiles WHERE email = 'valbona@deuss.com');

DELETE FROM public.profiles WHERE email = 'valbona@deuss.com';
