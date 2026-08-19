<?php
/**
 * Settings abilities (grouped).
 *
 * @package PrestoPlayer
 * @subpackage Services\Abilities\Abilities
 */

namespace PrestoPlayer\Services\Abilities\Abilities;

use PrestoPlayer\Services\Abilities\Ability;
use PrestoPlayer\Services\Abilities\Module;

/**
 * Returns the option groups registered with the settings registry.
 */
class GetSettingsAbility extends Ability {

	/**
	 * The option groups the settings abilities read and write.
	 *
	 * One source of truth for the read loop, the write whitelist, the input enum
	 * and the output schema. Each entry describes:
	 *
	 * - type            string  Top-level type: object, string, boolean.
	 * - fields          array   Whitelist of nested fields as JSON-schema properties.
	 *                           Omit to expose whatever the setting registered.
	 *                           Present-but-empty means "no raw field is exposed".
	 * - redacted        array   Nested fields reported as a `<field>_configured`
	 *                           boolean. The value never leaves the site and can
	 *                           never be written.
	 * - readonly        bool    Whole group is read-only.
	 * - readonly_fields array   Fields that can be read but never written.
	 * - enum            array   Allowed values for a scalar group.
	 * - default         mixed   Merge base / fallback when the option is unsaved.
	 *
	 * The whitelist is opt-in on purpose: a field nobody listed stays invisible,
	 * so a new secret added to a setting later isn't exposed by accident.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function groups() {
		// One abilities request asks for this ~60 times (output schema, read loop,
		// readValue() per key, defaultFor(), writableKeys()), so the filter and the
		// normalise pass run once per request instead. Anything hooking the filter
		// after the first call is ignored, which is fine: the hook is added at
		// service-registration time, long before an ability can run.
		static $memo = null;
		if ( null !== $memo ) {
			return $memo;
		}

		$groups = array(
			'presto_player_branding'               => array( 'type' => 'object' ),
			'presto_player_youtube'                => array( 'type' => 'object' ),
			'presto_player_presets'                => array( 'type' => 'object' ),
			'presto_player_audio_presets'          => array( 'type' => 'object' ),
			'presto_player_performance'            => array( 'type' => 'object' ),
			'presto_player_analytics'              => array(
				'type'            => 'object',
				// purge_data wipes the collected analytics rows. update-settings is
				// annotated non-destructive, so it stays readable but not writable —
				// an agent should not be able to trigger a data purge through a tool
				// the client was told is safe.
				'readonly_fields' => array( 'purge_data' ),
			),
			'presto_player_google_analytics'       => array( 'type' => 'object' ),
			// uninstall_data means "delete every video, preset and stat when the
			// plugin is removed". Read-only for the same reason as purge_data, and
			// since it's the group's only field the whole group is read-only.
			'presto_player_uninstall'              => array(
				'type'     => 'object',
				'readonly' => true,
			),
			'presto_player_instant_video_width'    => array(
				'type'    => 'string',
				'default' => '800px',
			),
			'presto_player_media_hub_sync_default' => array(
				'type'    => 'boolean',
				'default' => true,
			),
			'presto-player_usage_optin'            => array(
				'type'    => 'string',
				'enum'    => array( 'yes', 'no' ),
				'default' => 'no',
			),
			// presto_player_mcp is deliberately absent and cannot be added back
			// through the filter: it is the kill switch for the abilities system
			// itself, so an agent that could write it could switch off its own tools
			// or hand itself write access.
		);

		/**
		 * Filters the option groups the settings abilities expose.
		 *
		 * Pro and third parties describe their own option groups here rather than
		 * the free plugin enumerating keys it cannot see.
		 *
		 * @param array<string, array<string, mixed>> $groups Groups keyed by option name.
		 */
		$filtered = apply_filters( 'presto_player_ability_settings_groups', $groups );

		$memo = self::normalizeGroups( is_array( $filtered ) ? $filtered : $groups );

		return $memo;
	}

	/**
	 * Fill in the optional parts of every group and drop malformed entries.
	 *
	 * @param array<string, mixed> $groups Raw groups.
	 * @return array<string, array<string, mixed>>
	 */
	protected static function normalizeGroups( array $groups ) {
		$clean = array();
		foreach ( $groups as $key => $group ) {
			if ( ! is_string( $key ) || ! is_array( $group ) || empty( $group['type'] ) ) {
				continue;
			}
			if ( Module::OPTION_KEY === $key ) {
				continue;
			}
			$clean[ $key ] = array_merge(
				array(
					'fields'          => null,
					'redacted'        => array(),
					'readonly'        => false,
					'readonly_fields' => array(),
					'enum'            => array(),
				),
				$group
			);
		}
		return $clean;
	}

	/**
	 * The fields a group exposes: the ones it listed, or — when it listed none —
	 * the properties the setting itself registered.
	 *
	 * Never "whatever the option happens to hold". A group that names no fields
	 * used to hand back the raw option, so a credential added to one of these
	 * settings later would have started leaving the site on its own.
	 *
	 * @param string $key Option key.
	 * @return array<string, array<string, mixed>>
	 */
	public static function exposedFields( $key ) {
		$groups = self::groups();
		if ( ! isset( $groups[ $key ] ) ) {
			return array();
		}
		if ( null !== $groups[ $key ]['fields'] ) {
			return $groups[ $key ]['fields'];
		}
		$schema = self::registeredSchema( $key );
		return ! empty( $schema['properties'] ) && is_array( $schema['properties'] ) ? $schema['properties'] : array();
	}

	/**
	 * JSON-schema properties a group hands back on read, redaction included.
	 *
	 * @param string $key Option key.
	 * @return array<string, array<string, mixed>>
	 */
	public static function exposedProperties( $key ) {
		$groups = self::groups();
		if ( ! isset( $groups[ $key ] ) ) {
			return array();
		}
		$properties = self::exposedFields( $key );
		foreach ( $groups[ $key ]['redacted'] as $field ) {
			$properties[ $field . '_configured' ] = array( 'type' => 'boolean' );
		}
		return $properties;
	}

	/**
	 * The value of one group, shaped for output.
	 *
	 * Shared with the write ability so its response can't hand back a secret the
	 * read path would have redacted.
	 *
	 * @param string $key Option key.
	 * @return mixed
	 */
	public static function readValue( $key ) {
		$groups = self::groups();
		if ( ! isset( $groups[ $key ] ) ) {
			return null;
		}
		$group = $groups[ $key ];
		$value = get_option( $key, self::defaultFor( $key ) );

		if ( 'object' !== $group['type'] ) {
			// Booleans are stored via a %s placeholder, so an enabled value reads
			// back as the string '1'. Coerce every scalar to its declared type.
			$sanitized = rest_sanitize_value_from_schema( $value, array( 'type' => $group['type'] ), $key );
			return is_wp_error( $sanitized ) ? self::defaultFor( $key ) : $sanitized;
		}

		$value   = is_array( $value ) ? $value : array();
		$exposed = array();

		foreach ( self::exposedFields( $key ) as $field => $schema ) {
			if ( ! array_key_exists( $field, $value ) ) {
				continue;
			}
			$sanitized = rest_sanitize_value_from_schema( $value[ $field ], $schema, $field );
			if ( ! is_wp_error( $sanitized ) ) {
				$exposed[ $field ] = $sanitized;
			}
		}
		foreach ( $group['redacted'] as $field ) {
			// Report only whether it is set. The value itself is a credential or
			// an account id, and neither belongs in a tool response.
			$exposed[ $field . '_configured' ] = ! empty( $value[ $field ] );
		}

		// Object-typed settings must serialise as {} not [] when empty, else
		// clients validating structuredContent against the schema reject the call.
		return (object) $exposed;
	}

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/get-settings';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Get Presto Player settings', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Returns the current global player settings: branding, YouTube defaults, default presets, performance flags, analytics and Google Analytics state, instant video width, media hub sync default, usage opt-in, and any Pro settings groups. Credentials such as API keys and license keys are never returned — those are reported only as a "<field>_configured" boolean.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'   => true,
			'idempotent' => true,
			'admin'      => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		// This ability takes no input. `properties` is omitted rather than set to
		// an empty stdClass: core's rest_validate_object_value_from_schema() does
		// `isset( $args['properties'][ $property ] )` per incoming key, and an
		// array offset on stdClass is a fatal Error — so any stray key an MCP
		// client tacked on returned a 500 instead of a clean 400. Omitting the
		// key leaves that isset() false, additionalProperties still rejects the
		// key, and the emitted JSON Schema stays valid (an empty PHP array would
		// serialise as `[]`, not `{}`).
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		$properties = array();
		foreach ( self::groups() as $key => $group ) {
			if ( 'object' !== $group['type'] ) {
				$properties[ $key ] = array( 'type' => $group['type'] );
				continue;
			}
			$exposed            = self::exposedProperties( $key );
			$properties[ $key ] = empty( $exposed )
				? array( 'type' => 'object' )
				: array(
					'type'       => 'object',
					'properties' => $exposed,
				);
		}
		return array(
			'type'       => 'object',
			'properties' => $properties,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input (unused).
	 * @return array<string, mixed>
	 */
	public function execute( array $input ) {
		$result = array();
		foreach ( array_keys( self::groups() ) as $key ) {
			$result[ $key ] = self::readValue( $key );
		}
		return $result;
	}

	/**
	 * Registered REST schema for an option group, if any.
	 *
	 * @param string $key Option key.
	 * @return array<string, mixed>
	 */
	public static function registeredSchema( $key ) {
		$registered = get_registered_settings();
		if ( empty( $registered[ $key ]['show_in_rest']['schema'] ) ) {
			return array();
		}
		$schema = $registered[ $key ]['show_in_rest']['schema'];
		if ( empty( $schema['type'] ) ) {
			$schema['type'] = ! empty( $registered[ $key ]['type'] ) ? $registered[ $key ]['type'] : 'object';
		}
		return $schema;
	}

	/**
	 * Per-key default so scalar settings round-trip as scalars (not array()).
	 *
	 * Static because the write ability needs the same defaults when it reads a key
	 * back, and keeping a second copy there is how the two drift apart.
	 *
	 * The registry default wins over the registered one: Pro registers its
	 * settings on admin_init / rest_api_init, so get_registered_settings() is
	 * empty for Pro keys under WP-CLI and cron, and one Pro group's registered
	 * default is a copy-paste of another's.
	 *
	 * @param string $key Option key.
	 * @return mixed
	 */
	public static function defaultFor( $key ) {
		$groups = self::groups();
		if ( isset( $groups[ $key ] ) && array_key_exists( 'default', $groups[ $key ] ) ) {
			return $groups[ $key ]['default'];
		}

		// Fall back to whatever the setting was registered with, so a site that
		// has never saved an option group still reports its real values. Reading
		// a bare array() made every unsaved group look empty — "which preset is
		// the site default?" was unanswerable until someone happened to write.
		$registered = get_registered_settings();
		if ( isset( $registered[ $key ]['default'] ) ) {
			return $registered[ $key ]['default'];
		}

		return array();
	}
}

/**
 * Writes one of the whitelisted PP option groups.
 */
class UpdateSettingsAbility extends Ability {

	/**
	 * Option keys that accept a write right now.
	 *
	 * @return array<int, string>
	 */
	protected function writableKeys() {
		$keys = array();
		foreach ( GetSettingsAbility::groups() as $key => $group ) {
			if ( empty( $group['readonly'] ) ) {
				$keys[] = $key;
			}
		}
		return $keys;
	}

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/update-settings';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Update Presto Player settings', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Updates one of the global Presto Player option groups. Pass the option key and the new value object. Only the fields the group exposes can be written — credentials, derived flags and data-destroying toggles are read-only.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'    => false,
			'destructive' => false,
			'idempotent'  => true,
			'admin'       => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'key', 'value' ),
			'properties'           => array(
				'key'   => array(
					'type'        => 'string',
					'enum'        => $this->writableKeys(),
					'description' => __( 'Option key to update.', 'presto-player' ),
				),
				'value' => array(
					'type'        => array( 'object', 'array', 'string', 'number', 'integer', 'boolean' ),
					'description' => __( 'New value to store. An object for setting groups, or a scalar for the width / sync-default / usage opt-in keys.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'updated' => array( 'type' => 'boolean' ),
				'key'     => array( 'type' => 'string' ),
				'value'   => array(
					// Without an explicit type WP_Ability::validate_output() hands core a
					// typeless schema and every successful call trips _doing_it_wrong().
					'type'        => array( 'object', 'array', 'string', 'number', 'integer', 'boolean' ),
					'description' => __( 'The stored (sanitized) value, shaped the same way get-settings reports it.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		$key   = isset( $input['key'] ) ? sanitize_key( $input['key'] ) : '';
		$value = isset( $input['value'] ) ? $input['value'] : null;

		if ( ! in_array( $key, $this->writableKeys(), true ) ) {
			return new \WP_Error(
				'invalid_key',
				__( 'That option key is not allowed.', 'presto-player' ),
				array( 'status' => 400 )
			);
		}

		$clean = $this->sanitizeValue( $key, $value );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}

		// The site default has to name a preset that exists — storing an unknown
		// id used to succeed and left every player pointing at nothing. Audio
		// presets carry the same key against their own model, and 0 has to be
		// caught too: it is not "no change", it silently blanks the default.
		$preset_models = array(
			'presto_player_presets'       => \PrestoPlayer\Models\Preset::class,
			'presto_player_audio_presets' => \PrestoPlayer\Models\AudioPreset::class,
		);
		if ( isset( $preset_models[ $key ] ) && is_array( $clean ) && array_key_exists( 'default_player_preset', $clean ) ) {
			$preset_id = absint( $clean['default_player_preset'] );
			$model     = $preset_models[ $key ];
			$preset    = new $model( $preset_id );
			if ( ! $preset_id || ! $preset->id || $this->isSoftDeleted( $preset->toArray() ) ) {
				return new \WP_Error(
					'invalid_preset',
					__( 'That preset does not exist, so it cannot be the site default.', 'presto-player' ),
					array( 'status' => 400 )
				);
			}
		}

		// Object groups: update_option() replaces the whole option, so merge the
		// sanitized partial over the stored value. We validate the incoming value
		// (above), not the merge, so unknown-key rejection still applies to the
		// caller's input while sibling keys they didn't send — including the
		// credentials the whitelist keeps out of reach — are preserved instead of
		// being wiped. Merge onto the same base the read path reports: merging onto
		// a bare array() dropped every sibling that only existed as a registered
		// default, so writing one branding field on a never-saved site wiped the
		// player's accent colour.
		if ( is_array( $clean ) ) {
			$existing = get_option( $key, GetSettingsAbility::defaultFor( $key ) );
			if ( is_array( $existing ) ) {
				$clean = array_merge( $existing, $clean );
			}
		}

		update_option( $key, $clean );

		return array(
			'updated' => true,
			'key'     => $key,
			'value'   => GetSettingsAbility::readValue( $key ),
		);
	}

	/**
	 * Validate + sanitize an incoming value for the given option key.
	 *
	 * Branding has a registered top-level sanitize_callback (sanitizeBranding,
	 * including CSS handling) that update_option() runs, so it passes through
	 * untouched. Scalar groups are coerced to their declared type, and object
	 * groups are validated against the group's writable schema since their
	 * per-property sanitizers don't fire on a direct update_option() call.
	 *
	 * @param string $key   Whitelisted option key.
	 * @param mixed  $value Raw incoming value.
	 * @return mixed|\WP_Error Clean value, or WP_Error when the shape is invalid.
	 */
	protected function sanitizeValue( $key, $value ) {
		$groups = GetSettingsAbility::groups();
		$group  = $groups[ $key ];

		if ( 'object' !== $group['type'] ) {
			if ( is_array( $value ) ) {
				return new \WP_Error(
					'invalid_value',
					/* translators: %s: option key. */
					sprintf( __( 'Expected a scalar value for %s.', 'presto-player' ), $key ),
					array( 'status' => 400 )
				);
			}
			if ( ! empty( $group['enum'] ) && ! in_array( (string) $value, $group['enum'], true ) ) {
				return new \WP_Error(
					'invalid_value',
					sprintf(
						/* translators: 1: option key, 2: comma-separated list of allowed values. */
						__( 'Allowed values for %1$s are: %2$s.', 'presto-player' ),
						$key,
						implode( ', ', $group['enum'] )
					),
					array( 'status' => 400 )
				);
			}
			if ( 'boolean' === $group['type'] ) {
				return rest_sanitize_boolean( (string) $value );
			}
			return sanitize_text_field( (string) $value );
		}

		if ( ! is_array( $value ) ) {
			return new \WP_Error(
				'invalid_value',
				/* translators: %s: option key. */
				sprintf( __( 'Expected an object value for %s.', 'presto-player' ), $key ),
				array( 'status' => 400 )
			);
		}

		if ( 'presto_player_branding' === $key ) {
			// Branding has a registered top-level sanitize_callback (sanitizeBranding)
			// that update_option() runs, so pass it through untouched here rather
			// than sanitizing it twice. It has to come after the array check: handed
			// a scalar, sanitizeBranding returns array() and the logo, colour and
			// custom CSS are gone from the site while this still reports success.
			return $value;
		}

		$schema = $this->writeSchema( $key );
		if ( is_wp_error( $schema ) ) {
			return $schema;
		}

		$valid = rest_validate_value_from_schema( $value, $schema, $key );
		if ( is_wp_error( $valid ) ) {
			$valid->add_data( array( 'status' => 400 ) );
			return $valid;
		}

		return rest_sanitize_value_from_schema( $value, $schema, $key );
	}

	/**
	 * Schema an incoming object write is validated against: the fields the group
	 * exposes, minus the read-only and redacted ones.
	 *
	 * @param string $key Option key.
	 * @return array<string, mixed>|\WP_Error
	 */
	protected function writeSchema( $key ) {
		$groups = GetSettingsAbility::groups();
		$group  = $groups[ $key ];

		$schema = array(
			'type'       => 'object',
			'properties' => GetSettingsAbility::exposedFields( $key ),
		);
		if ( null === $group['fields'] && empty( $schema['properties'] ) ) {
			return new \WP_Error(
				'invalid_value',
				/* translators: %s: option key. */
				sprintf( __( 'No registered schema for %s; refusing to write a free-form value.', 'presto-player' ), $key ),
				array( 'status' => 400 )
			);
		}

		foreach ( array_merge( $group['readonly_fields'], $group['redacted'] ) as $field ) {
			unset( $schema['properties'][ $field ] );
		}

		if ( empty( $schema['properties'] ) ) {
			return new \WP_Error(
				'readonly_setting',
				/* translators: %s: option key. */
				sprintf( __( '%s has no writable fields.', 'presto-player' ), $key ),
				array( 'status' => 400 )
			);
		}

		// Confine writes to the declared properties so an AI client can't smuggle
		// unknown keys into the stored option.
		$schema['additionalProperties'] = false;

		return $schema;
	}
}
