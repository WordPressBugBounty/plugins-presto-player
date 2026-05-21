import { useHistory } from "../router/router";
import { addQueryArgs } from '@wordpress/url';
import { runNavGuards } from '../pages/settings/shared/navigationGuard';

const useLink = (params) => {
  const history = useHistory();

  const href = addQueryArgs(window.location.pathname, params);

  const onClick = (event) => {
    event.preventDefault();
    if ( runNavGuards( params ) ) {
      return;
    }
    history.push(params);
  };

  return { href, onClick };
};

export default useLink;
