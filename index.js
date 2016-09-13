var path = require('path');
var fs = require('fs');
var CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');

// When the plugin is first instantiated, it saves all modules to be loaded in this
// cache. On second instances, it uses the cache. The webpack server needs to be
// restarted to clear it.
var cache;

function Apps(opts) {
    opts = opts || {};

    // all modules to be loaded
    this.apps = [];

    // the root directory to be scanned for modules
    this.homeDir = opts.path || path.join(process.cwd(), 'apps');

    this.entry = opts.entry || 'app';

    if (typeof cache === 'undefined') {
        fs.readdirSync(this.homeDir).forEach(this.load, this);
        cache = this.apps;
    } else {
        this.apps = cache;
    }
}

// attempts to load the module at relative path 'p' inside the home directory.
Apps.prototype.load = function(p) {
    if (p === '.' || p === '..') {
        return;
    }

    var manifestPath = path.join(this.homeDir, p, 'manifest.json');
    var data;

    try {
        // try to read the manifest file
        data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch(e) {
        console.error('[Autoloader Plugin] ERROR: invalid manifest in ' + p);
    }

    // if a valid manifest file was found, store it.
    if (data) {
        console.log('[Autoloader Plugin] MODULE: ' + p + '(' + data.module + ')');
        this.apps.push({
            description: data.description,
            name: p,
            entry: data.entry,
            ngModule: data.module,
            context: path.dirname(manifestPath)
        });
    }
}

Apps.prototype.apply = function(compiler) {
    var apps = this.apps;

	compiler.plugin("compilation", function(compilation, params) {
		var nmf = params.normalModuleFactory;
		compilation.dependencyFactories.set(CommonJsRequireDependency, nmf);
		compilation.dependencyTemplates.set(CommonJsRequireDependency, new CommonJsRequireDependency.Template());
    });

    compiler.parser.plugin('expression __PLUGIN_APPS__', function(expr) {
        apps.forEach(function(app) {
            var dep = new CommonJsRequireDependency(path.join(app.context, app.entry), expr.range);
            dep.loc = expr.loc;
            dep.optional = false;
            this.state.current.addDependency(dep);
            return true;
        }, this);

        console.log(this.state.current);
    });
}

module.exports = Apps;

function validateJSON(body) {
    try {
        var data = JSON.parse(body);
        return data;
    } catch(e) {
        return null;
    }
}
