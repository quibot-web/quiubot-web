// Lo que Quiubot guarda de la conexión con Meta de un usuario, y cómo queda
// al usar "Desconectar Meta" (app/api/meta/desconectar). La cuenta de
// Instagram no se guarda: se resuelve en vivo desde la página.
export const CAMPOS_CONEXION_META = {
  meta_access_token: null,
  meta_token_expira: null,
  meta_token_vencera_avisado: false,
  meta_ad_account_id: null,
  meta_ad_account_nombre: null,
  meta_business_id: null,
  meta_user_name: null,
  meta_page_id: null,
  meta_page_name: null,
  meta_pixel_id: null,
  meta_pixel_nombre: null,
} as const;
