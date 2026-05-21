/**
 * Classnames utility - exact copy of SureDash implementation
 */
export default function classnames(...args) {
  const classes = [];

  args.forEach((arg) => {
    if (typeof arg === "string" || typeof arg === "number") {
      classes.push(arg);
    } else if (Array.isArray(arg)) {
      classes.push(classnames(...arg));
    } else if (typeof arg === "object") {
      Object.keys(arg).forEach((key) => {
        if (arg[key]) {
          classes.push(key);
        }
      });
    }
  });

  return classes.join(" ");
}
