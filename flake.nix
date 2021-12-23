{
  description = "Node.js development environment";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShell = with pkgs;
          let nodejs = nodejs-16_x;
          in mkShell {
            nativeBuildInputs = [
              bashInteractive
              git
              nodejs
              nixfmt
            ];
          };
      });
}
