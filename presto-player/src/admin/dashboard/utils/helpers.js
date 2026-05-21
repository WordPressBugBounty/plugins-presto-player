/**
 * General utility helper functions
 */

/**
 * Conditionally joins CSS class names together
 * Filters out falsy values for conditional classes
 *
 * @param {...(string|false|null|undefined)} classes - Class names to combine
 * @returns {string} Combined class names
 *
 * @example
 * classNames('btn', 'btn-primary') // Returns: "btn btn-primary"
 * classNames('btn', isActive && 'active') // Returns: "btn active" or "btn"
 * classNames('btn', null, undefined, 'large') // Returns: "btn large"
 */
export const classNames = (...classes) => {
  return classes.filter(Boolean).join(" ");
};
