<?php if ( ! defined( 'ABSPATH' ) ) { exit; } // Exit if accessed directly. ?>
<figure class="wp-block-video presto-unauthorized" style="<?php echo esc_attr($data['styles']) ?>">
  <presto-video-curtain-ui>
    <span><?php esc_html_e('Please login for access.', 'presto-player') ?></span>
    <presto-player-button full type="primary" href="<?php echo esc_url(wp_login_url()); ?>">
      <?php esc_html_e('Login', 'presto-player'); ?>
    </presto-player-button>
  </presto-video-curtain-ui>
</figure>