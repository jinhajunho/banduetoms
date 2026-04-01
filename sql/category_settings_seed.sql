-- 기본 분류 시드: id=1 행이 없을 때만 삽입 (이미 있으면 아무 것도 안 함)
-- app.js에서는 분류 목록을 비우고, 이 데이터는 DB가 단일 출처입니다.

insert into public.category_settings (id, payload, updated_at)
select
    1,
    jsonb_build_object(
        '1',
        jsonb_build_array(
            jsonb_build_object('name', 'B2B', 'active', true),
            jsonb_build_object('name', 'B2C', 'active', true),
            jsonb_build_object('name', '컨텍터스', 'active', true)
        ),
        '2',
        jsonb_build_array(
            jsonb_build_object('name', '코오롱', 'active', true),
            jsonb_build_object('name', '저스트코', 'active', true),
            jsonb_build_object('name', '다락', 'active', true),
            jsonb_build_object('name', '관리건물', 'active', true)
        ),
        '3',
        jsonb_build_array(
            jsonb_build_object('name', '강남', 'active', true),
            jsonb_build_object('name', '강서', 'active', true),
            jsonb_build_object('name', '파견', 'active', true),
            jsonb_build_object('name', '지원', 'active', true),
            jsonb_build_object('name', '공사', 'active', true)
        )
    ),
    now()
where not exists (select 1 from public.category_settings where id = 1);
