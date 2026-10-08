-- ONB-01-B5: ONLY an explicitly disposable PostgreSQL 18 named radar_fiscal_onb01_b5.
-- Synthetic CNAE, official-looking schema, NOT official production data.
DO $$
BEGIN
  IF current_database() <> 'radar_fiscal_onb01_b5'
     OR current_setting('server_version_num')::int < 180000
     OR current_setting('server_version_num')::int >= 190000 THEN
    RAISE EXCEPTION 'B5 refuses non-disposable PostgreSQL 18';
  END IF;
END $$;
INSERT INTO official_catalogs(code, name, maintainer)
VALUES ('CNAE','CNAE test-only','IBGE-SYNTHETIC-FIXTURE')
ON CONFLICT (code) DO NOTHING;
INSERT INTO official_catalog_editions(catalog_id,edition_code,source_url,status)
SELECT id,'onb01-b5-synthetic-only','https://example.test/synthetic-cnae','CURRENT'
FROM official_catalogs c
WHERE c.code='CNAE'
  AND NOT EXISTS (SELECT 1 FROM official_catalog_editions e
                  WHERE e.catalog_id=c.id AND e.status='CURRENT')
ON CONFLICT (catalog_id,edition_code) DO NOTHING;
INSERT INTO official_catalog_entries(catalog_edition_id,official_code,description,metadata)
SELECT e.id, '6201-5/01', 'Desenvolvimento de programas de computador sob encomenda',
       '{"level":"SUBCLASSE","assignable":true,"synthetic_fixture":true}'::jsonb
FROM official_catalog_editions e JOIN official_catalogs c ON c.id=e.catalog_id
WHERE c.code='CNAE' AND e.status='CURRENT'
ON CONFLICT (catalog_edition_id,official_code) DO NOTHING;
INSERT INTO cnaes(code,description,is_active)
VALUES ('6201501','Desenvolvimento de programas de computador sob encomenda',true)
ON CONFLICT (code) DO NOTHING;
DO $$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM official_catalog_entries ent
  JOIN official_catalog_editions e ON e.id=ent.catalog_edition_id
  JOIN official_catalogs c ON c.id=e.catalog_id
  WHERE c.code='CNAE' AND e.status='CURRENT'
    AND regexp_replace(ent.official_code,'[^0-9]','','g')='6201501'
    AND ent.metadata->>'level'='SUBCLASSE'
    AND ent.metadata->>'assignable'='true')
 OR (SELECT description FROM cnaes WHERE code='6201501')
    IS DISTINCT FROM 'Desenvolvimento de programas de computador sob encomenda'
 THEN RAISE EXCEPTION 'B5 synthetic catalog seed is not canonical';
 END IF;
END $$;
