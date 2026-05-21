const guards = new Set();

export const registerNavGuard = ( guard ) => {
	guards.add( guard );
	return () => {
		guards.delete( guard );
	};
};

export const runNavGuards = ( target ) => {
	for ( const guard of guards ) {
		if ( guard( target ) === true ) {
			return true;
		}
	}
	return false;
};
