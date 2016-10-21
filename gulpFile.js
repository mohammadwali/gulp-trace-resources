var gulp = require("gulp");
var through = require("through2");
var traceResources = require("./index");

gulp.task("default", function () {
    return gulp.src(["demo.html", "demo2.html"])
        .pipe(traceResources())
        .pipe(gulp.dest("./"));
});