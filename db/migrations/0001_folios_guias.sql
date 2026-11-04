CREATE FUNCTION asignar_folio_guia() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  bodega integer := coalesce(NEW.bodega_origen_id, NEW.bodega_destino_id);
  correlativo bigint;
BEGIN
  IF bodega = 1 THEN
    correlativo := nextval('folios_bodega_1');
  ELSIF bodega = 2 THEN
    correlativo := nextval('folios_bodega_2');
  ELSE
    RAISE EXCEPTION 'Bodega invalida para generar folio';
  END IF;
  NEW.folio := 'G' || bodega::text || '-' || lpad(correlativo::text, 6, '0');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guias_asignar_folio BEFORE INSERT ON guias
FOR EACH ROW EXECUTE FUNCTION asignar_folio_guia();
