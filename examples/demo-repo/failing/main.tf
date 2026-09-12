terraform {
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = "eu-west-1"
}

resource "aws_s3_bucket" "reports" {
  bucket = "guardai-demo-reports"
  acl    = "public-read"
}

resource "aws_security_group" "internal_api" {
  name        = "internal-api"
  description = "Internal API"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "primary" {
  identifier          = "guardai-demo-primary"
  engine              = "postgres"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  publicly_accessible = true
  username            = "appuser"
  password            = "SuperSecret123"
}
