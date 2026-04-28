output "ec2_instance_id" {
  description = "EC2 instance ID (dùng để SSM vào)"
  value       = aws_instance.app.id
}

output "ssm_connect_command" {
  description = "Lệnh SSM vào EC2"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}
