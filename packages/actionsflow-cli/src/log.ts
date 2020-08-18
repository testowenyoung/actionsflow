import chalk from "chalk";
import Log from "loglevel";
import prefix from "loglevel-plugin-prefix";
const log = Log.getLogger("actionsflow");
interface IColors {
  [key: string]: chalk.Chalk;
}
const colors: IColors = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red,
};
prefix.reg(Log);
log.setDefaultLevel("info");
prefix.apply(log, {
  format(level, name, timestamp) {
    return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](
      level
    )} ${chalk.green(`${name}:`)}`;
  },
});
export default log;
